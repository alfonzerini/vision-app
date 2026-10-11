"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { stripeConfigured } from "@/lib/stripe/env";
import {
  ensureConnectedAccount,
  createOnboardingLink,
  createExpressLoginLink,
  readAccountStatus,
} from "@/lib/stripe/connect";

/**
 * Start (or resume) Stripe payout onboarding: ensure a connected account exists,
 * then send the cleaner to Stripe's hosted onboarding.
 */
export async function startPayoutOnboarding() {
  const user = await requireRole("cleaner");
  if (!stripeConfigured) redirect("/cleaner/payouts?error=unavailable");

  const accountId = await ensureConnectedAccount(user.id, user.email);
  const baseUrl = await getBaseUrl();
  const url = await createOnboardingLink(accountId, baseUrl);
  redirect(url);
}

/** Open the cleaner's Stripe Express dashboard (for onboarded accounts). */
export async function openExpressDashboard() {
  const user = await requireRole("cleaner");
  if (!stripeConfigured) redirect("/cleaner/payouts?error=unavailable");

  const status = await readAccountStatus(user.id);
  if (!status.accountId) redirect("/cleaner/payouts");
  const url = await createExpressLoginLink(status.accountId);
  redirect(url);
}
