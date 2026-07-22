-- ============================================================================
-- Vision — Fix infinite recursion in RLS policies (migration 0004)
-- ============================================================================
-- PROBLEM: policies that check another table trigger THAT table's policies.
-- `jobs` looked at `quotes`, and `quotes` looked back at `jobs` → Postgres
-- detected infinite recursion (error 42P17) and refused every query.
--
-- FIX: move every cross-table check into a SECURITY DEFINER function. Those run
-- with the definer's rights, so they read the other table WITHOUT re-triggering
-- its policies — breaking the loop. The access rules themselves are unchanged;
-- only how they are evaluated changes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Cross-table helper predicates (all SECURITY DEFINER → no policy recursion)
-- ---------------------------------------------------------------------------

-- Current user is the customer who created the job.
create or replace function public.owns_job(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from jobs j where j.id = job and j.customer_id = auth.uid()) $$;

-- Current user is the cleaner assigned to the job.
create or replace function public.is_assigned_cleaner(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from jobs j where j.id = job and j.assigned_cleaner_id = auth.uid()) $$;

-- `who` is one of the two parties on the job (customer or assigned cleaner).
create or replace function public.is_party_of_job(job uuid, who uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from jobs j
    where j.id = job and who in (j.customer_id, j.assigned_cleaner_id)
  )
$$;

-- Convenience: the CURRENT user is a party on the job.
create or replace function public.is_job_party(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_party_of_job(job, auth.uid()) $$;

-- The job is published and accepting quotes.
create or replace function public.job_is_open(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from jobs j where j.id = job and j.status = 'open') $$;

-- Current user (a cleaner) has already quoted on the job.
create or replace function public.has_quoted_on(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from quotes q where q.job_id = job and q.cleaner_id = auth.uid()) $$;

-- Full "can this user see the job at all" test, reused by job_photos.
create or replace function public.can_view_job(job uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from jobs j
    where j.id = job and (
      j.customer_id = auth.uid()
      or j.assigned_cleaner_id = auth.uid()
      or (public.my_role() = 'cleaner' and j.status = 'open')
    )
  )
$$;

-- Current user is assigned to a job at this property (needs the address).
create or replace function public.cleaner_serves_property(prop uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from jobs j where j.property_id = prop and j.assigned_cleaner_id = auth.uid()) $$;

-- Dispute helpers.
create or replace function public.raised_dispute(d uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from disputes dd where dd.id = d and dd.raised_by = auth.uid()) $$;

create or replace function public.is_dispute_party(d uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from disputes dd join jobs j on j.id = dd.job_id
    where dd.id = d and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
  )
$$;

-- ===========================================================================
-- Recreate the affected policies using the helpers above.
-- ===========================================================================

-- PROPERTIES ----------------------------------------------------------------
drop policy if exists "properties: owner, assigned cleaner, or admin read" on properties;
create policy "properties: owner, assigned cleaner, or admin read"
  on properties for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or public.cleaner_serves_property(id)
  );

-- JOBS ----------------------------------------------------------------------
drop policy if exists "jobs: read (owner / marketplace / quoted / assigned / admin)" on jobs;
create policy "jobs: read (owner / marketplace / quoted / assigned / admin)"
  on jobs for select using (
    customer_id = auth.uid()
    or assigned_cleaner_id = auth.uid()
    or public.is_admin()
    or (
      public.my_role() = 'cleaner'
      and (status = 'open' or public.has_quoted_on(id))
    )
  );

-- JOB PHOTOS ----------------------------------------------------------------
drop policy if exists "job_photos: read if job visible" on job_photos;
create policy "job_photos: read if job visible"
  on job_photos for select using (
    public.is_admin() or public.can_view_job(job_id)
  );

drop policy if exists "job_photos: customer of job uploads" on job_photos;
create policy "job_photos: customer of job uploads"
  on job_photos for insert with check (public.owns_job(job_id));

-- QUOTES --------------------------------------------------------------------
drop policy if exists "quotes: cleaner-owner, job-owner, or admin read" on quotes;
create policy "quotes: cleaner-owner, job-owner, or admin read"
  on quotes for select using (
    cleaner_id = auth.uid() or public.is_admin() or public.owns_job(job_id)
  );

drop policy if exists "quotes: verified cleaner submits on open job" on quotes;
create policy "quotes: verified cleaner submits on open job"
  on quotes for insert with check (
    cleaner_id = auth.uid()
    and public.my_role() = 'cleaner'
    and public.job_is_open(job_id)
  );

drop policy if exists "quotes: cleaner-owner or job-owner or admin update" on quotes;
create policy "quotes: cleaner-owner or job-owner or admin update"
  on quotes for update using (
    cleaner_id = auth.uid() or public.is_admin() or public.owns_job(job_id)
  );

-- MESSAGES ------------------------------------------------------------------
drop policy if exists "messages: parties of the job send" on messages;
create policy "messages: parties of the job send"
  on messages for insert with check (
    sender_id = auth.uid() and public.is_job_party(job_id)
  );

-- COMPLETION EVIDENCE -------------------------------------------------------
drop policy if exists "completion_evidence: job parties or admin read" on completion_evidence;
create policy "completion_evidence: job parties or admin read"
  on completion_evidence for select using (
    public.is_admin() or public.is_job_party(job_id)
  );

drop policy if exists "completion_evidence: assigned cleaner uploads" on completion_evidence;
create policy "completion_evidence: assigned cleaner uploads"
  on completion_evidence for insert with check (
    cleaner_id = auth.uid() and public.is_assigned_cleaner(job_id)
  );

-- REVIEWS -------------------------------------------------------------------
drop policy if exists "reviews: job party writes about counterparty" on reviews;
create policy "reviews: job party writes about counterparty"
  on reviews for insert with check (
    reviewer_id = auth.uid()
    and reviewee_id <> auth.uid()
    and public.is_party_of_job(job_id, auth.uid())
    and public.is_party_of_job(job_id, reviewee_id)
  );

-- DISPUTES ------------------------------------------------------------------
drop policy if exists "disputes: parties or admin read" on disputes;
create policy "disputes: parties or admin read"
  on disputes for select using (
    raised_by = auth.uid() or public.is_admin() or public.is_job_party(job_id)
  );

drop policy if exists "disputes: customer of job raises" on disputes;
create policy "disputes: customer of job raises"
  on disputes for insert with check (
    raised_by = auth.uid() and public.owns_job(job_id)
  );

drop policy if exists "dispute_evidence: parties or admin read" on dispute_evidence;
create policy "dispute_evidence: parties or admin read"
  on dispute_evidence for select using (
    public.is_admin() or public.is_dispute_party(dispute_id)
  );

drop policy if exists "dispute_evidence: raiser uploads" on dispute_evidence;
create policy "dispute_evidence: raiser uploads"
  on dispute_evidence for insert with check (public.raised_dispute(dispute_id));
