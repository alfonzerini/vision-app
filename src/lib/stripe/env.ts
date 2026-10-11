/**
 * Stripe connection settings, read from the environment.
 *
 * As with Supabase, we never throw at import time when keys are missing so the
 * app keeps running before payments are connected. Code that needs Stripe
 * checks `stripeConfigured` (or calls `getStripe()`, which throws a clear error).
 *
 * All keys are SERVER-ONLY secrets — none are NEXT_PUBLIC. We use Stripe's
 * hosted Checkout and hosted Connect onboarding, so the browser never needs a
 * publishable key.
 */
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/** True once the Stripe secret key is present. */
export const stripeConfigured = Boolean(STRIPE_SECRET_KEY);

/**
 * Public base URL for building Stripe return/redirect links. Falls back to the
 * local dev server. On Vercel this should be the production URL.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
