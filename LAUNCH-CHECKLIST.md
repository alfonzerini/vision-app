# Vision — pre-launch checklist

Things that are deliberately set up for **development convenience** and MUST be
changed before real customers use Vision.

## Security / auth

- [ ] **Re-enable "Confirm email"** in Supabase → Authentication → Providers →
      Email. It was turned OFF on 2026-07-22 so we could create test accounts
      without hitting the free tier's ~2–3 emails/hour limit. Leaving it off in
      production lets anyone sign up using someone else's email address.
- [ ] **Delete all test accounts** (any `@visiontest.uk` / obviously fake users)
      from Supabase → Authentication → Users.
- [ ] **Set up a proper transactional email provider** (e.g. Resend / Postmark)
      in Supabase → Authentication → Emails → SMTP. The built-in Supabase mailer
      is rate-limited and not for production.
- [ ] **Rotate the `service_role` key** if it has ever been shared or pasted
      anywhere outside `.env.local`.
- [ ] Confirm `.env.local` is still git-ignored and no secrets are committed.
- [ ] Add a password-reset flow (not built yet).
- [ ] Review Supabase → Authentication → Rate limits before launch.

## Data / correctness

- [x] ✅ **GPS RADIUS RESET TO 200 METRES (2026-10-11).** It had been raised to
      100,000,000 on 2026-10-07 to allow off-site completion testing. Reverted via
      the Supabase SQL editor and verified (`gps_radius_metres = 200`). The on-site
      location check is active again — cleaners must be within 200m to complete a job.
- [ ] Create the **first admin user** manually (public signup deliberately
      cannot create admins). Set `role = 'admin'` on that profile in the
      Supabase table editor or via SQL.
- [ ] Verify RLS policies against a real multi-user test (customer A must not
      see customer B's jobs, cleaner A must not see cleaner B's quotes).

## Payments (Stripe Connect — built 2026-10-11, see STRIPE-SETUP.md)

- [ ] One-time TEST setup: Stripe account + Connect on, API/webhook keys,
      service_role key, CRON_SECRET in Vercel, apply migration 0013. (STRIPE-SETUP.md)
- [ ] Test the full loop in test mode (payout onboarding → pay → complete → release).
- [ ] Switch Stripe keys from test mode to live mode + complete platform activation.
- [ ] Recreate the webhook endpoint + signing secret for LIVE, update Vercel.
- [ ] Confirm commission rate in `platform_settings` is correct (default 15%).
- [ ] Build admin dispute-resolution UI that calls refundJobPayment() for upheld
      disputes (code exists; no admin trigger yet — funds stay safely held meanwhile).

## Legal / UK compliance

- [ ] Privacy policy + terms of service pages.
- [ ] Cookie/consent handling.
- [ ] GDPR: data export + account deletion flow.
