import "server-only";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, stripeConfigured } from "./env";

let cached: Stripe | null = null;

/**
 * Returns a configured Stripe client, or throws a clear error if the secret key
 * isn't set. Server-only — never import into a client component.
 */
export function getStripe(): Stripe {
  if (!stripeConfigured) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — Stripe is not configured yet.",
    );
  }
  if (!cached) {
    cached = new Stripe(STRIPE_SECRET_KEY, {
      // Matches the version this SDK is generated against; bump with the SDK.
      apiVersion: "2026-09-30.endive",
      appInfo: { name: "Vision", url: "https://vision-app-peach.vercel.app" },
    });
  }
  return cached;
}
