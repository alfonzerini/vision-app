-- ============================================================================
-- Vision — Row-Level Security policies (migration 0002)
-- ============================================================================
-- These policies run INSIDE Postgres on every query, so role boundaries are
-- enforced even if the frontend or API has a bug. Principle of least privilege:
--   * Customers can only see their own data (+ counterparties on assigned jobs).
--   * Cleaners can browse OPEN jobs and see only jobs they quoted/are assigned to.
--   * Admins can see/do everything.
--   * Money movements (payments) are system-only — never writable by end users.
--
-- The Supabase "service role" key (used only in trusted server code / webhooks)
-- bypasses RLS entirely; that is how the backend performs privileged actions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read profiles without
-- triggering the profiles RLS policies — this avoids infinite recursion).
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- True if the current user and `other` are the two parties on the same job.
create or replace function public.shares_job_with(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from jobs j
    where (j.customer_id = auth.uid() and j.assigned_cleaner_id = other)
       or (j.assigned_cleaner_id = auth.uid() and j.customer_id = other)
  )
$$;

-- ---------------------------------------------------------------------------
-- Anti-escalation triggers: users must not promote themselves.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only an administrator can change a user role';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function public.guard_profile_role();

-- A cleaner must not mark themselves verified (that is an admin approval).
create or replace function public.guard_cleaner_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.is_verified is distinct from old.is_verified
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only an administrator can verify a cleaner';
  end if;
  return new;
end;
$$;
create trigger cleaner_profiles_guard_verification
  before update on cleaner_profiles
  for each row execute function public.guard_cleaner_verification();

-- ===========================================================================
-- PROFILES
-- ===========================================================================
create policy "profiles: read own / counterparty / admin"
  on profiles for select using (
    id = auth.uid() or public.is_admin() or public.shares_job_with(id)
  );

create policy "profiles: update own or admin"
  on profiles for update using (id = auth.uid() or public.is_admin());
-- (No insert policy: rows are created by the handle_new_user trigger.)

-- ===========================================================================
-- CLEANER PROFILES  (public marketplace info — no PII columns here)
-- ===========================================================================
create policy "cleaner_profiles: readable by anyone"
  on cleaner_profiles for select using (true);

create policy "cleaner_profiles: owner or admin writes"
  on cleaner_profiles for update using (profile_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- SERVICE TYPES  (public catalogue; only admins edit)
-- ===========================================================================
create policy "service_types: public read"
  on service_types for select using (true);
create policy "service_types: admin write"
  on service_types for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- CLEANER SERVICES
-- ===========================================================================
create policy "cleaner_services: readable by anyone"
  on cleaner_services for select using (true);
create policy "cleaner_services: owner or admin manage"
  on cleaner_services for all
  using (cleaner_id = auth.uid() or public.is_admin())
  with check (cleaner_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- PROPERTIES
-- ===========================================================================
create policy "properties: owner, assigned cleaner, or admin read"
  on properties for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from jobs j
      where j.property_id = properties.id and j.assigned_cleaner_id = auth.uid()
    )
  );
create policy "properties: owner or admin write"
  on properties for all
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- JOBS
-- ===========================================================================
create policy "jobs: read (owner / marketplace / quoted / assigned / admin)"
  on jobs for select using (
    customer_id = auth.uid()
    or assigned_cleaner_id = auth.uid()
    or public.is_admin()
    or (
      public.my_role() = 'cleaner' and (
        status = 'open'
        or exists (select 1 from quotes q where q.job_id = jobs.id and q.cleaner_id = auth.uid())
      )
    )
  );
create policy "jobs: customer creates own"
  on jobs for insert with check (
    customer_id = auth.uid() and public.my_role() = 'customer'
  );
create policy "jobs: owner / assigned cleaner / admin update"
  on jobs for update using (
    customer_id = auth.uid() or assigned_cleaner_id = auth.uid() or public.is_admin()
  );
create policy "jobs: owner deletes draft, or admin"
  on jobs for delete using (
    (customer_id = auth.uid() and status = 'draft') or public.is_admin()
  );

-- ===========================================================================
-- JOB PHOTOS  (visible to whoever can see the job)
-- ===========================================================================
create policy "job_photos: read if job visible"
  on job_photos for select using (
    exists (
      select 1 from jobs j where j.id = job_photos.job_id and (
        j.customer_id = auth.uid() or j.assigned_cleaner_id = auth.uid()
        or public.is_admin() or (public.my_role() = 'cleaner' and j.status = 'open')
      )
    )
  );
create policy "job_photos: customer of job uploads"
  on job_photos for insert with check (
    exists (select 1 from jobs j where j.id = job_photos.job_id and j.customer_id = auth.uid())
  );

-- ===========================================================================
-- QUOTES
-- ===========================================================================
create policy "quotes: cleaner-owner, job-owner, or admin read"
  on quotes for select using (
    cleaner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from jobs j where j.id = quotes.job_id and j.customer_id = auth.uid())
  );
create policy "quotes: verified cleaner submits on open job"
  on quotes for insert with check (
    cleaner_id = auth.uid()
    and public.my_role() = 'cleaner'
    and exists (select 1 from jobs j where j.id = quotes.job_id and j.status = 'open')
  );
create policy "quotes: cleaner-owner or job-owner or admin update"
  on quotes for update using (
    cleaner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from jobs j where j.id = quotes.job_id and j.customer_id = auth.uid())
  );

-- ===========================================================================
-- MESSAGES
-- ===========================================================================
create policy "messages: sender or recipient or admin read"
  on messages for select using (
    sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin()
  );
create policy "messages: parties of the job send"
  on messages for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from jobs j where j.id = messages.job_id
        and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
    )
  );
create policy "messages: recipient marks read"
  on messages for update using (recipient_id = auth.uid());

-- ===========================================================================
-- STRIPE ACCOUNTS  (owner reads; writes happen via service role / webhooks)
-- ===========================================================================
create policy "stripe_accounts: owner or admin read"
  on stripe_accounts for select using (profile_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- PAYMENTS  (read-only to the parties; all writes are system-only)
-- ===========================================================================
create policy "payments: parties or admin read"
  on payments for select using (
    customer_id = auth.uid() or cleaner_id = auth.uid() or public.is_admin()
  );
-- No insert/update policies: only the service role (trusted server) can move money.

-- ===========================================================================
-- COMPLETION EVIDENCE
-- ===========================================================================
create policy "completion_evidence: job parties or admin read"
  on completion_evidence for select using (
    public.is_admin()
    or exists (
      select 1 from jobs j where j.id = completion_evidence.job_id
        and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
    )
  );
create policy "completion_evidence: assigned cleaner uploads"
  on completion_evidence for insert with check (
    cleaner_id = auth.uid()
    and exists (
      select 1 from jobs j where j.id = completion_evidence.job_id
        and j.assigned_cleaner_id = auth.uid()
    )
  );

-- ===========================================================================
-- REVIEWS  (publicly readable; written by a job party about the other)
-- ===========================================================================
create policy "reviews: public read"
  on reviews for select using (true);
create policy "reviews: job party writes about counterparty"
  on reviews for insert with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from jobs j where j.id = reviews.job_id
        and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
        and reviews.reviewee_id in (j.customer_id, j.assigned_cleaner_id)
        and reviews.reviewee_id <> auth.uid()
    )
  );

-- ===========================================================================
-- DISPUTES
-- ===========================================================================
create policy "disputes: parties or admin read"
  on disputes for select using (
    raised_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from jobs j where j.id = disputes.job_id
        and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
    )
  );
create policy "disputes: customer of job raises"
  on disputes for insert with check (
    raised_by = auth.uid()
    and exists (select 1 from jobs j where j.id = disputes.job_id and j.customer_id = auth.uid())
  );
create policy "disputes: admin resolves"
  on disputes for update using (public.is_admin());

create policy "dispute_evidence: parties or admin read"
  on dispute_evidence for select using (
    public.is_admin()
    or exists (
      select 1 from disputes d join jobs j on j.id = d.job_id
      where d.id = dispute_evidence.dispute_id
        and auth.uid() in (j.customer_id, j.assigned_cleaner_id)
    )
  );
create policy "dispute_evidence: raiser uploads"
  on dispute_evidence for insert with check (
    exists (select 1 from disputes d where d.id = dispute_evidence.dispute_id and d.raised_by = auth.uid())
  );

-- ===========================================================================
-- DOCUMENTS  (cleaner uploads; admin verifies — status guarded in app/service)
-- ===========================================================================
create policy "documents: owner or admin read"
  on documents for select using (cleaner_id = auth.uid() or public.is_admin());
create policy "documents: owner uploads"
  on documents for insert with check (cleaner_id = auth.uid());
create policy "documents: owner or admin update"
  on documents for update using (cleaner_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- NOTIFICATIONS  (created by the system; user reads / marks own)
-- ===========================================================================
create policy "notifications: owner or admin read"
  on notifications for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications: owner marks read"
  on notifications for update using (user_id = auth.uid());

-- ===========================================================================
-- PLATFORM SETTINGS  (anyone signed in can read; only admins change)
-- ===========================================================================
create policy "platform_settings: authenticated read"
  on platform_settings for select using (auth.uid() is not null);
create policy "platform_settings: admin write"
  on platform_settings for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- AUDIT LOGS  (admin read-only; inserts happen via service role)
-- ===========================================================================
create policy "audit_logs: admin read"
  on audit_logs for select using (public.is_admin());
