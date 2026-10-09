-- ============================================================================
-- Vision — Admin dashboard stats (migration 0012)
-- ============================================================================
-- One admin-only function returning everything the dashboard needs: user/job
-- counts, commission earned per window (today/week/month/financial-year/all),
-- and daily (90d) + monthly (12m) series. Commission = platform rate × the
-- agreed price of each COMPLETED job (real figures even before Stripe).
-- UK financial year starts 6 April.
-- ============================================================================

set search_path = public, extensions;

create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_rate numeric := coalesce(
    (select (value #>> '{}')::numeric from platform_settings where key = 'commission_rate'), 0.15);
  v_fy_start date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can view these stats';
  end if;

  v_fy_start := case
    when current_date >= make_date(extract(year from current_date)::int, 4, 6)
      then make_date(extract(year from current_date)::int, 4, 6)
      else make_date(extract(year from current_date)::int - 1, 4, 6)
  end;

  result := jsonb_build_object(
    'commission_rate', v_rate,
    'fy_start', to_char(v_fy_start, 'YYYY-MM-DD'),
    'counts', (
      select jsonb_build_object(
        'customers', count(*) filter (where role = 'customer'),
        'cleaners',  count(*) filter (where role = 'cleaner')
      ) from profiles
    ),
    'jobs', (
      select jsonb_build_object(
        'total',     count(*),
        'open',      count(*) filter (where status = 'open'),
        'active',    count(*) filter (where status in ('assigned','in_progress','awaiting_review')),
        'completed', count(*) filter (where status = 'completed'),
        'disputed',  count(*) filter (where status = 'disputed')
      ) from jobs
    ),
    'commission', (
      select jsonb_build_object(
        'today', coalesce(sum(round(agreed_price_pence * v_rate)) filter (where completed_at::date = current_date), 0),
        'week',  coalesce(sum(round(agreed_price_pence * v_rate)) filter (where completed_at >= date_trunc('week', now())), 0),
        'month', coalesce(sum(round(agreed_price_pence * v_rate)) filter (where completed_at >= date_trunc('month', now())), 0),
        'fy',    coalesce(sum(round(agreed_price_pence * v_rate)) filter (where completed_at >= v_fy_start), 0),
        'all',   coalesce(sum(round(agreed_price_pence * v_rate)), 0)
      ) from jobs where status = 'completed' and agreed_price_pence is not null
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'd', to_char(d, 'YYYY-MM-DD'), 'jobs', j, 'commission', c) order by d), '[]'::jsonb)
      from (
        select gs::date d,
               count(jb.id) j,
               coalesce(sum(round(jb.agreed_price_pence * v_rate)), 0) c
        from generate_series(current_date - interval '89 days', current_date, interval '1 day') gs
        left join jobs jb
          on jb.status = 'completed'
          and jb.completed_at::date = gs::date
          and jb.agreed_price_pence is not null
        group by gs::date
      ) t
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'm', to_char(mo, 'YYYY-MM'), 'jobs', j, 'commission', c) order by mo), '[]'::jsonb)
      from (
        select date_trunc('month', gs)::date mo,
               count(jb.id) j,
               coalesce(sum(round(jb.agreed_price_pence * v_rate)), 0) c
        from generate_series(
          date_trunc('month', current_date) - interval '11 months',
          date_trunc('month', current_date), interval '1 month') gs
        left join jobs jb
          on jb.status = 'completed'
          and date_trunc('month', jb.completed_at) = gs
          and jb.agreed_price_pence is not null
        group by date_trunc('month', gs)::date
      ) t
    )
  );
  return result;
end;
$$;

grant execute on function public.admin_stats() to authenticated;
