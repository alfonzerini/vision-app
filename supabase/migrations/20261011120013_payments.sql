-- ===========================================================================
-- Stripe Connect payments — escrow model.
--
--   * confirm_job_payment(): called by the Stripe webhook (service role only)
--     once a customer has PAID for a quote. Atomically assigns the cleaner,
--     rejects the other quotes, records the held payment, and notifies both
--     parties — the paid equivalent of the old accept_quote() flow.
--
-- Money movements (the Stripe PaymentIntent and Transfer themselves) happen in
-- trusted server code; this function only records the resulting state. The
-- payments table stays system-only (no end-user write policy), so this runs as
-- SECURITY DEFINER and is revoked from end users.
-- ===========================================================================

create or replace function public.confirm_job_payment(
  p_quote_id       uuid,
  p_payment_intent text,
  p_amount         integer,
  p_currency       text default 'gbp'
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job        uuid;
  v_cleaner    uuid;
  v_customer   uuid;
  v_status     job_status;
  v_rate       numeric;
  v_commission integer;
  v_cleaner_amt integer;
begin
  -- Idempotency: Stripe can deliver a webhook more than once.
  if exists (
    select 1 from payments where stripe_payment_intent_id = p_payment_intent
  ) then
    return 'already_processed';
  end if;

  select q.job_id, q.cleaner_id
    into v_job, v_cleaner
  from quotes q where q.id = p_quote_id;
  if v_job is null then
    return 'quote_missing';
  end if;

  -- Lock the job row so two concurrent payments can't both assign it.
  select customer_id, status into v_customer, v_status
  from jobs where id = v_job for update;

  if v_status <> 'open' then
    -- The job was already taken (e.g. the customer paid on two quotes). The
    -- caller refunds this payment.
    return 'not_open';
  end if;

  v_rate := coalesce(
    (select (value #>> '{}')::numeric from platform_settings where key = 'commission_rate'),
    0.15);
  v_commission  := round(p_amount * v_rate);
  v_cleaner_amt := p_amount - v_commission;

  update jobs
    set assigned_cleaner_id = v_cleaner,
        accepted_quote_id   = p_quote_id,
        agreed_price_pence  = p_amount,
        status              = 'assigned'
    where id = v_job;

  update quotes set status = 'accepted' where id = p_quote_id;
  update quotes set status = 'rejected'
    where job_id = v_job and id <> p_quote_id and status = 'pending';

  insert into payments (
    job_id, customer_id, cleaner_id, currency, amount_pence,
    commission_pence, cleaner_amount_pence, status,
    stripe_payment_intent_id, held_at
  ) values (
    v_job, v_customer, v_cleaner, p_currency, p_amount,
    v_commission, v_cleaner_amt, 'held', p_payment_intent, now()
  );

  insert into notifications (user_id, type, title, body, data) values
    (v_cleaner, 'quote_accepted', 'Your quote was accepted!',
     'You''ve been booked and the payment is secured. Check your schedule.',
     jsonb_build_object('job_id', v_job, 'quote_id', p_quote_id)),
    (v_customer, 'payment_successful', 'Payment held securely',
     'Your payment is held and released to the cleaner once the job is complete.',
     jsonb_build_object('job_id', v_job));

  return 'assigned';
end;
$$;

-- Only trusted server code (service role) may call this — never end users.
revoke all on function public.confirm_job_payment(uuid, text, integer, text)
  from public;
grant execute on function public.confirm_job_payment(uuid, text, integer, text)
  to service_role;
