# Stripe Connect setup (one-time)

Vision now has escrow payments built in. To switch them on you need a Stripe
account and a few keys. **Do it all in Stripe TEST mode first** — no real money
moves, and you can test the whole flow with fake cards.

Nothing here is live until you finish these steps; the app keeps working without
them (it just shows "payments launching soon").

---

## 1. Create / open your Stripe account

1. Go to https://dashboard.stripe.com and sign up (or log in).
2. Make sure the **"Test mode"** toggle (top-right) is **ON** for everything below.

## 2. Turn on Connect (this is what lets cleaners get paid)

1. In the dashboard, search for **"Connect"** and click **Get started / Enable**.
2. If asked, choose **Platform or marketplace**.
3. That's it for now — we create the cleaner accounts automatically from the app.

## 3. Copy your API secret key

1. Go to **Developers → API keys**.
2. Copy the **Secret key** (starts `sk_test_...`). You'll paste it in step 6.

## 4. Create the webhook

This is how Stripe tells Vision when a payment succeeds.

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://vision-app-peach.vercel.app/api/stripe/webhook`
3. Under **Select events**, add these two:
   - `checkout.session.completed`
   - `account.updated`
4. Click **Add endpoint**, then copy its **Signing secret** (starts `whsec_...`).

## 5. Get your Supabase service-role key

The payment code needs this to safely move money.

1. Supabase dashboard → **Settings → API keys**.
2. Copy the **`service_role`** key (the secret one — keep it private).

## 6. Add the keys to Vercel

In Vercel → your **vision-app** project → **Settings → Environment Variables**,
add these four, each as a **normal environment variable** (just paste the value —
do NOT use the "Secret" reference type; that corrupted a key once before):

| Name | Value |
|------|-------|
| `STRIPE_SECRET_KEY` | your `sk_test_...` from step 3 |
| `STRIPE_WEBHOOK_SECRET` | your `whsec_...` from step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from step 5 |
| `CRON_SECRET` | any long random string you make up |

Set them for **Production** (and Preview if you like), then **redeploy**.

(For local testing, paste the same values into `.env.local`. The webhook secret
for local is different — use the Stripe CLI: `stripe listen --forward-to
localhost:3000/api/stripe/webhook`.)

## 7. Apply the database migration

Paste `supabase/migrations/20261011120013_payments.sql` into the Supabase SQL
editor and run it (same as previous migrations).

---

## Testing it (all in test mode)

**Cleaner payout setup** (`/cleaner/payouts` → Set up payouts):
- Stripe's test onboarding accepts dummy data. Use test bank details:
  **sort code `10-88-00`, account `00012345`**.

**Customer pays** (Accept & pay on a quote):
- Test card: **`4242 4242 4242 4242`**, any future expiry, any CVC, any postcode.

**Full loop:** cleaner sets up payouts → customer accepts & pays → cleaner marks
complete (photos + GPS) → customer confirms → cleaner's 85% is transferred,
Vision keeps 15%.

## When you go live

- Switch Stripe to live mode, create live API keys + a live webhook, and swap
  the Vercel env vars for the live values.
- Complete Stripe's platform activation (business details) for live payouts.
