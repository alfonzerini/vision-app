-- ============================================================================
-- Vision — Reviews & ratings, avatars, live notifications (migration 0010)
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. REVIEWS: keep a cleaner's average rating up to date from the reviews table
-- ---------------------------------------------------------------------------
create or replace function public.recompute_cleaner_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reviewee uuid := coalesce(new.reviewee_id, old.reviewee_id);
begin
  if exists (select 1 from cleaner_profiles where profile_id = v_reviewee) then
    update cleaner_profiles cp
    set avg_rating = coalesce(
          (select round(avg(rating)::numeric, 2) from reviews where reviewee_id = v_reviewee), 0),
        rating_count = (select count(*) from reviews where reviewee_id = v_reviewee)
    where cp.profile_id = v_reviewee;
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_recompute_rating on reviews;
create trigger reviews_recompute_rating
  after insert or update or delete on reviews
  for each row execute function public.recompute_cleaner_rating();

-- Submit a review: figures out who you are reviewing (the other party) and
-- enforces one review per person per completed job.
create or replace function public.submit_review(
  p_job_id uuid,
  p_rating smallint,
  p_body text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid;
  v_cleaner uuid;
  v_status job_status;
  v_reviewer uuid := auth.uid();
  v_reviewee uuid;
  v_id uuid;
begin
  select customer_id, assigned_cleaner_id, status
    into v_customer, v_cleaner, v_status
  from jobs where id = p_job_id;

  if v_customer is null then raise exception 'Job not found'; end if;
  if v_status <> 'completed' then
    raise exception 'You can only review a completed job';
  end if;

  if v_reviewer = v_customer then v_reviewee := v_cleaner;
  elsif v_reviewer = v_cleaner then v_reviewee := v_customer;
  else raise exception 'You are not part of this job';
  end if;
  if v_reviewee is null then raise exception 'There is no one to review'; end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5 stars';
  end if;
  if exists (select 1 from reviews where job_id = p_job_id and reviewer_id = v_reviewer) then
    raise exception 'You have already reviewed this job';
  end if;

  insert into reviews (job_id, reviewer_id, reviewee_id, rating, body)
  values (p_job_id, v_reviewer, v_reviewee, p_rating, nullif(btrim(p_body), ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.submit_review(uuid, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. AVATARS: a PUBLIC bucket for profile photos (path = "<user_id>/...")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars: owner uploads" on storage.objects;
create policy "avatars: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner updates" on storage.objects;
create policy "avatars: owner updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner deletes" on storage.objects;
create policy "avatars: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 3. quotes_for_job: include the cleaner's avatar (return type changes → drop)
-- ---------------------------------------------------------------------------
drop function if exists public.quotes_for_job(uuid);
create function public.quotes_for_job(p_job_id uuid)
returns table (
  quote_id uuid,
  amount_pence integer,
  message text,
  status quote_status,
  created_at timestamptz,
  cleaner_id uuid,
  business_name text,
  avatar_url text,
  avg_rating numeric,
  rating_count integer,
  completed_jobs integer
)
language sql stable security definer set search_path = public, extensions as $$
  select
    q.id, q.amount_pence, q.message, q.status, q.created_at, q.cleaner_id,
    coalesce(cp.business_name, pr.full_name, 'Cleaner'),
    pr.avatar_url,
    coalesce(cp.avg_rating, 0), coalesce(cp.rating_count, 0), coalesce(cp.completed_jobs, 0)
  from quotes q
  join jobs j on j.id = q.job_id
  left join cleaner_profiles cp on cp.profile_id = q.cleaner_id
  left join profiles pr on pr.id = q.cleaner_id
  where q.job_id = p_job_id
    and j.customer_id = auth.uid()
  order by q.amount_pence asc;
$$;
grant execute on function public.quotes_for_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. NOTIFICATIONS: deliver live (idempotent add to the realtime publication)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
