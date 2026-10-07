-- ============================================================================
-- Vision — Safety net: 48h auto-complete + customer disputes (migration 0007)
-- ============================================================================
-- Adds (all money-independent; Stripe payout/hold hooks in later):
--   * review window changed 24h -> 48h
--   * auto_complete_overdue_jobs(): closes jobs whose 48h review window passed
--     with no dispute (intended to be run on a schedule — see the pg_cron
--     snippet provided separately)
--   * raise_dispute(): a customer reports a problem instead of confirming;
--     the job moves to 'disputed' and stays there for admin review
-- ============================================================================

set search_path = public, extensions;

-- 48-hour review window (was 24h).
update platform_settings set value = '48' where key = 'review_window_hours';

-- ---------------------------------------------------------------------------
-- Auto-complete jobs whose review window has elapsed without a dispute.
-- Returns how many were completed. Runs as a privileged scheduled task.
-- ---------------------------------------------------------------------------
create or replace function public.auto_complete_overdue_jobs()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, assigned_cleaner_id
    from jobs
    where status = 'awaiting_review'
      and review_deadline_at is not null
      and review_deadline_at < now()
  loop
    update jobs set status = 'completed' where id = r.id;
    update cleaner_profiles
      set completed_jobs = completed_jobs + 1
      where profile_id = r.assigned_cleaner_id;
    -- (Stripe payout will be triggered here in the payments milestone.)
    insert into notifications (user_id, type, title, body, data)
    values (
      r.assigned_cleaner_id, 'job_complete', 'Job auto-confirmed',
      'The 48-hour review window passed with no issues, so this job is now complete.',
      jsonb_build_object('job_id', r.id)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer reports a problem instead of confirming. One dispute per job, and
-- only while the job is awaiting their review.
-- ---------------------------------------------------------------------------
create or replace function public.raise_dispute(
  p_job_id uuid,
  p_reason dispute_reason,
  p_description text
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_customer uuid;
  v_status job_status;
  v_cleaner uuid;
  v_id uuid;
begin
  select customer_id, status, assigned_cleaner_id
    into v_customer, v_status, v_cleaner
  from jobs where id = p_job_id;

  if v_customer is distinct from auth.uid() then
    raise exception 'Only the customer can report a problem on this job';
  end if;
  if v_status <> 'awaiting_review' then
    raise exception 'You can only report a problem while reviewing the completed work';
  end if;
  if p_description is null or length(trim(p_description)) < 10 then
    raise exception 'Please describe the problem in a little more detail';
  end if;
  if exists (select 1 from disputes where job_id = p_job_id) then
    raise exception 'A problem has already been reported for this job';
  end if;

  insert into disputes (job_id, raised_by, reason, description, status)
  values (p_job_id, auth.uid(), p_reason, p_description, 'open')
  returning id into v_id;

  -- Funds stay held (once Stripe is live); job awaits admin review.
  update jobs set status = 'disputed' where id = p_job_id;

  insert into notifications (user_id, type, title, body, data)
  values (
    v_cleaner, 'dispute_raised', 'A problem was reported',
    'The customer has reported a problem with this job. Our team will review it.',
    jsonb_build_object('job_id', p_job_id, 'dispute_id', v_id)
  );
  return v_id;
end;
$$;

grant execute on function public.raise_dispute(uuid, dispute_reason, text) to authenticated;
-- auto_complete_overdue_jobs is intentionally NOT granted to end users;
-- it's invoked by the scheduled task (running as a privileged role).
