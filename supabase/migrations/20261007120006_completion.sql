-- ============================================================================
-- Vision — Job completion + photo storage (migration 0006)
-- ============================================================================
-- Adds:
--   * A PRIVATE Supabase Storage bucket "job-media" for completion photos,
--     with policies so only the job's parties can see them and only the
--     assigned cleaner can upload. Photos are stored under "<job_id>/<file>".
--   * SECURITY DEFINER functions for the completion flow:
--       start_job()         cleaner marks the job started (in_progress)
--       complete_job()      cleaner submits completion: requires the minimum
--                           number of after-photos AND GPS within the allowed
--                           radius of the property; moves job to awaiting_review
--       confirm_completion() customer confirms the work is done -> completed
-- Payment release on confirmation is a later milestone (Stripe).
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Private storage bucket for job photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-media', 'job-media', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;

-- Only the assigned cleaner may upload into a job's folder (path = "<job_id>/...").
drop policy if exists "job-media: assigned cleaner uploads" on storage.objects;
create policy "job-media: assigned cleaner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-media'
    and public.is_assigned_cleaner(((storage.foldername(name))[1])::uuid)
  );

-- Either party on the job (and admins) may view the photos.
drop policy if exists "job-media: job parties read" on storage.objects;
create policy "job-media: job parties read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-media'
    and (
      public.is_admin()
      or public.is_job_party(((storage.foldername(name))[1])::uuid)
    )
  );

-- The assigned cleaner may remove a photo they uploaded (e.g. a mistake)
-- before the customer confirms.
drop policy if exists "job-media: assigned cleaner deletes" on storage.objects;
create policy "job-media: assigned cleaner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-media'
    and public.is_assigned_cleaner(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- helper: read an integer platform setting with a fallback
-- ---------------------------------------------------------------------------
create or replace function public.setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from platform_settings where key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------------
-- 2. start_job() — cleaner marks the assigned job as started
-- ---------------------------------------------------------------------------
create or replace function public.start_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status job_status;
  v_cleaner uuid;
begin
  select status, assigned_cleaner_id into v_status, v_cleaner
  from jobs where id = p_job_id;
  if v_cleaner is distinct from auth.uid() then
    raise exception 'Only the assigned cleaner can start this job';
  end if;
  if v_status <> 'assigned' then
    raise exception 'This job cannot be started right now';
  end if;
  update jobs set status = 'in_progress' where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. complete_job() — cleaner submits completion with GPS + photo checks
-- ---------------------------------------------------------------------------
create or replace function public.complete_job(
  p_job_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status job_status;
  v_cleaner uuid;
  v_customer uuid;
  v_loc geography;
  v_photos int;
  v_min_photos int := public.setting_int('min_after_photos', 3);
  v_radius int := public.setting_int('gps_radius_metres', 200);
  v_window int := public.setting_int('review_window_hours', 24);
  v_distance double precision;
begin
  select j.status, j.assigned_cleaner_id, j.customer_id, p.location
    into v_status, v_cleaner, v_customer, v_loc
  from jobs j join properties p on p.id = j.property_id
  where j.id = p_job_id;

  if v_cleaner is distinct from auth.uid() then
    raise exception 'Only the assigned cleaner can complete this job';
  end if;
  if v_status not in ('assigned', 'in_progress') then
    raise exception 'This job cannot be completed right now';
  end if;

  select count(*) into v_photos
  from completion_evidence
  where job_id = p_job_id and kind = 'after';
  if v_photos < v_min_photos then
    raise exception 'Please upload at least % after-photos (you have %)', v_min_photos, v_photos;
  end if;

  if v_loc is null then
    raise exception 'This property has no saved location, so we cannot verify you are on site';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Location is required to complete a job';
  end if;
  v_distance := ST_Distance(v_loc, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
  if v_distance > v_radius then
    raise exception 'You appear to be % metres from the property; you must be within % metres to mark it complete',
      round(v_distance)::int, v_radius;
  end if;

  update jobs
    set status = 'awaiting_review',
        completed_at = now(),
        review_deadline_at = now() + make_interval(hours => v_window)
    where id = p_job_id;

  insert into notifications (user_id, type, title, body, data)
  values (
    v_customer, 'job_complete', 'Your job has been completed',
    'Your cleaner has finished and uploaded photos. Please review and confirm.',
    jsonb_build_object('job_id', p_job_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. confirm_completion() — customer confirms the work is done
-- ---------------------------------------------------------------------------
create or replace function public.confirm_completion(p_job_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status job_status;
  v_customer uuid;
  v_cleaner uuid;
begin
  select status, customer_id, assigned_cleaner_id
    into v_status, v_customer, v_cleaner
  from jobs where id = p_job_id;

  if v_customer is distinct from auth.uid() then
    raise exception 'Only the customer can confirm this job';
  end if;
  if v_status <> 'awaiting_review' then
    raise exception 'This job is not awaiting your confirmation';
  end if;

  update jobs set status = 'completed' where id = p_job_id;

  update cleaner_profiles
    set completed_jobs = completed_jobs + 1
    where profile_id = v_cleaner;

  -- (Payment release via Stripe will hook in here in a later milestone.)
  insert into notifications (user_id, type, title, body, data)
  values (
    v_cleaner, 'job_complete', 'Job confirmed complete',
    'The customer has confirmed the job is done. Nice work!',
    jsonb_build_object('job_id', p_job_id)
  );
end;
$$;

grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid, double precision, double precision) to authenticated;
grant execute on function public.confirm_completion(uuid) to authenticated;
grant execute on function public.setting_int(text, int) to authenticated;
