-- ============================================================================
-- Vision — Schedule the 48h auto-complete task (migration 0008)
-- ============================================================================
-- Runs auto_complete_overdue_jobs() every hour via pg_cron.
--
-- NOTE: pg_cron must be enabled first. If the CREATE EXTENSION line errors,
-- enable it once in the Supabase Dashboard: Database → Extensions → search
-- "pg_cron" → enable, then run this file again.
-- ============================================================================

create extension if not exists pg_cron;

-- Remove any previous copy of this schedule, then (re)create it hourly.
select cron.unschedule('vision-auto-complete')
where exists (select 1 from cron.job where jobname = 'vision-auto-complete');

select cron.schedule(
  'vision-auto-complete',
  '0 * * * *',
  $$ select public.auto_complete_overdue_jobs(); $$
);
