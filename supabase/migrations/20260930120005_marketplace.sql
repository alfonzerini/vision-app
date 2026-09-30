-- ============================================================================
-- Vision — Marketplace: geolocation + cleaner feed, quoting, acceptance (0005)
-- ============================================================================
-- Adds:
--   * latitude/longitude columns (+ triggers) that keep the PostGIS location
--     columns in sync, so the app only ever writes plain numbers.
--   * SECURITY DEFINER functions for the marketplace loop. These run with
--     elevated rights so they can compute distance against a customer's address
--     WITHOUT exposing that address to a cleaner who hasn't been assigned the
--     job. They each re-check auth.uid() so callers only get what they should.
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Lat/long columns + triggers that populate the geography columns
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

alter table cleaner_profiles
  add column if not exists base_latitude  double precision,
  add column if not exists base_longitude double precision;

create or replace function public.sync_property_location()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_sync_location on properties;
create trigger properties_sync_location
  before insert or update of latitude, longitude on properties
  for each row execute function public.sync_property_location();

create or replace function public.sync_cleaner_location()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.base_latitude is not null and new.base_longitude is not null then
    new.base_location := ST_SetSRID(ST_MakePoint(new.base_longitude, new.base_latitude), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists cleaner_profiles_sync_location on cleaner_profiles;
create trigger cleaner_profiles_sync_location
  before insert or update of base_latitude, base_longitude on cleaner_profiles
  for each row execute function public.sync_cleaner_location();

-- ---------------------------------------------------------------------------
-- 2. jobs_near_me() — open jobs within the calling cleaner's coverage radius.
--    Returns COARSE location only (town + outward postcode) + distance.
--    Never the exact address.
-- ---------------------------------------------------------------------------
create or replace function public.jobs_near_me()
returns table (
  id uuid,
  clean_type clean_type,
  window_count integer,
  has_conservatory boolean,
  has_skylights boolean,
  has_solar_panels boolean,
  has_veranda boolean,
  preferred_date date,
  preferred_time text,
  created_at timestamptz,
  city text,
  postcode_area text,
  distance_m double precision,
  has_quoted boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select
    j.id, j.clean_type, j.window_count,
    j.has_conservatory, j.has_skylights, j.has_solar_panels, j.has_veranda,
    j.preferred_date, j.preferred_time, j.created_at,
    p.city,
    split_part(p.postcode, ' ', 1) as postcode_area,
    ST_Distance(p.location, c.base_location) as distance_m,
    exists (
      select 1 from quotes q
      where q.job_id = j.id and q.cleaner_id = auth.uid()
        and q.status in ('pending', 'accepted')
    ) as has_quoted
  from jobs j
  join properties p on p.id = j.property_id
  join cleaner_profiles c on c.profile_id = auth.uid()
  where j.status = 'open'
    and c.base_location is not null
    and p.location is not null
    and ST_DWithin(p.location, c.base_location, c.coverage_radius_m)
  order by distance_m asc;
$$;

-- ---------------------------------------------------------------------------
-- 3. job_for_cleaner(job_id) — one job's quotable detail for a cleaner.
--    Coarse location + scope + the caller's own existing quote (if any).
--    Only for open jobs, or a job the caller quoted on / is assigned to.
-- ---------------------------------------------------------------------------
create or replace function public.job_for_cleaner(p_job_id uuid)
returns table (
  id uuid,
  status job_status,
  clean_type clean_type,
  window_count integer,
  has_conservatory boolean,
  has_skylights boolean,
  has_solar_panels boolean,
  has_veranda boolean,
  additional_notes text,
  preferred_date date,
  preferred_time text,
  created_at timestamptz,
  city text,
  postcode_area text,
  distance_m double precision,
  my_quote_id uuid,
  my_quote_amount_pence integer,
  my_quote_status quote_status
)
language sql stable security definer set search_path = public, extensions as $$
  select
    j.id, j.status, j.clean_type, j.window_count,
    j.has_conservatory, j.has_skylights, j.has_solar_panels, j.has_veranda,
    j.additional_notes, j.preferred_date, j.preferred_time, j.created_at,
    p.city,
    split_part(p.postcode, ' ', 1) as postcode_area,
    ST_Distance(p.location, c.base_location) as distance_m,
    q.id, q.amount_pence, q.status
  from jobs j
  join properties p on p.id = j.property_id
  left join cleaner_profiles c on c.profile_id = auth.uid()
  left join quotes q
    on q.job_id = j.id and q.cleaner_id = auth.uid()
    and q.status in ('pending', 'accepted')
  where j.id = p_job_id
    and public.my_role() = 'cleaner'
    and (
      j.status = 'open'
      or j.assigned_cleaner_id = auth.uid()
      or exists (select 1 from quotes qq where qq.job_id = j.id and qq.cleaner_id = auth.uid())
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. submit_quote() — cleaner posts (or updates) their quote on an open job.
--    Also notifies the customer. Returns the quote id.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quote(
  p_job_id uuid,
  p_amount_pence integer,
  p_message text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_customer uuid;
  v_status job_status;
  v_quote_id uuid;
  v_validity int;
begin
  if public.my_role() <> 'cleaner' then
    raise exception 'Only cleaners can submit quotes';
  end if;
  if p_amount_pence is null or p_amount_pence < 0 then
    raise exception 'A valid quote amount is required';
  end if;

  select customer_id, status into v_customer, v_status from jobs where id = p_job_id;
  if v_customer is null then
    raise exception 'Job not found';
  end if;
  if v_status <> 'open' then
    raise exception 'This job is no longer open for quotes';
  end if;

  -- platform_settings.value is jsonb; extract as text before casting to int.
  select (value #>> '{}')::int into v_validity
  from platform_settings where key = 'quote_validity_hours';
  v_validity := coalesce(v_validity, 72);

  -- Update an existing pending quote, or insert a new one.
  select id into v_quote_id
  from quotes
  where job_id = p_job_id and cleaner_id = auth.uid() and status = 'pending';

  if v_quote_id is not null then
    update quotes
      set amount_pence = p_amount_pence,
          message = p_message,
          valid_until = now() + make_interval(hours => v_validity)
      where id = v_quote_id;
  else
    insert into quotes (job_id, cleaner_id, amount_pence, message, status, valid_until)
    values (p_job_id, auth.uid(), p_amount_pence, p_message, 'pending',
            now() + make_interval(hours => v_validity))
    returning id into v_quote_id;
  end if;

  -- Notify the customer (in-app).
  insert into notifications (user_id, type, title, body, data)
  values (
    v_customer, 'new_quote', 'New quote received',
    'A cleaner has sent you a quote.',
    jsonb_build_object('job_id', p_job_id, 'quote_id', v_quote_id)
  );

  return v_quote_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. quotes_for_job() — the customer's view of all quotes on their job,
--    enriched with the cleaner's PUBLIC profile info (name/rating), which the
--    profiles RLS would otherwise hide before assignment.
-- ---------------------------------------------------------------------------
create or replace function public.quotes_for_job(p_job_id uuid)
returns table (
  quote_id uuid,
  amount_pence integer,
  message text,
  status quote_status,
  created_at timestamptz,
  cleaner_id uuid,
  business_name text,
  avg_rating numeric,
  rating_count integer,
  completed_jobs integer
)
language sql stable security definer set search_path = public, extensions as $$
  select
    q.id, q.amount_pence, q.message, q.status, q.created_at,
    q.cleaner_id,
    coalesce(cp.business_name, pr.full_name, 'Cleaner') as business_name,
    coalesce(cp.avg_rating, 0), coalesce(cp.rating_count, 0), coalesce(cp.completed_jobs, 0)
  from quotes q
  join jobs j on j.id = q.job_id
  left join cleaner_profiles cp on cp.profile_id = q.cleaner_id
  left join profiles pr on pr.id = q.cleaner_id
  where q.job_id = p_job_id
    and j.customer_id = auth.uid()      -- only the job's owner
  order by q.amount_pence asc;
$$;

-- ---------------------------------------------------------------------------
-- 6. accept_quote() — customer accepts a quote: assign the cleaner, reject the
--    rest, notify. (Payment/escrow via Stripe is a later milestone.)
-- ---------------------------------------------------------------------------
create or replace function public.accept_quote(p_quote_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job uuid;
  v_cleaner uuid;
  v_amount integer;
  v_customer uuid;
  v_status job_status;
begin
  select q.job_id, q.cleaner_id, q.amount_pence
    into v_job, v_cleaner, v_amount
  from quotes q where q.id = p_quote_id and q.status = 'pending';
  if v_job is null then
    raise exception 'Quote not found or no longer available';
  end if;

  select customer_id, status into v_customer, v_status from jobs where id = v_job;
  if v_customer <> auth.uid() then
    raise exception 'You can only accept quotes on your own job';
  end if;
  if v_status <> 'open' then
    raise exception 'This job is no longer open';
  end if;

  update jobs
    set assigned_cleaner_id = v_cleaner,
        accepted_quote_id = p_quote_id,
        agreed_price_pence = v_amount,
        status = 'assigned'
    where id = v_job;

  update quotes set status = 'accepted' where id = p_quote_id;
  update quotes set status = 'rejected'
    where job_id = v_job and id <> p_quote_id and status = 'pending';

  insert into notifications (user_id, type, title, body, data)
  values (
    v_cleaner, 'quote_accepted', 'Your quote was accepted!',
    'You''ve been booked for a job. Check your schedule.',
    jsonb_build_object('job_id', v_job, 'quote_id', p_quote_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: let signed-in users call these (each function guards itself).
-- ---------------------------------------------------------------------------
grant execute on function public.jobs_near_me() to authenticated;
grant execute on function public.job_for_cleaner(uuid) to authenticated;
grant execute on function public.submit_quote(uuid, integer, text) to authenticated;
grant execute on function public.quotes_for_job(uuid) to authenticated;
grant execute on function public.accept_quote(uuid) to authenticated;
