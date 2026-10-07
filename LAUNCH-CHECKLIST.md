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

- [ ] ⚠️ **RESET THE GPS RADIUS BACK TO 200 METRES.** On 2026-10-07 the
      `gps_radius_metres` setting was raised from 200 to 100,000,000 (effectively
      disabling the on-site location check) so Alfie could test job completion
      while not physically at the test property. This MUST be put back to 200
      before real use, or cleaners could mark jobs complete from anywhere.
      Fix (Supabase SQL editor): `update platform_settings set value = '200' where key = 'gps_radius_metres';`
- [ ] Create the **first admin user** manually (public signup deliberately
      cannot create admins). Set `role = 'admin'` on that profile in the
      Supabase table editor or via SQL.
- [ ] Verify RLS policies against a real multi-user test (customer A must not
      see customer B's jobs, cleaner A must not see cleaner B's quotes).

## Payments (when Stripe is added)

- [ ] Switch Stripe keys from test mode to live mode.
- [ ] Verify the Stripe webhook endpoint + signing secret in production.
- [ ] Confirm commission rate in `platform_settings` is correct (default 15%).

## Legal / UK compliance

- [ ] Privacy policy + terms of service pages.
- [ ] Cookie/consent handling.
- [ ] GDPR: data export + account deletion flow.
