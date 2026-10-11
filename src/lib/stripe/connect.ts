import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AccountStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

const EMPTY: AccountStatus = {
  accountId: null,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};

/**
 * Ensure the cleaner has a Stripe Express connected account, creating one on
 * first use. Returns the Stripe account id. Writes go through the service-role
 * client because stripe_accounts is system-only.
 */
export async function ensureConnectedAccount(
  profileId: string,
  email: string | null | undefined,
): Promise<string> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (row?.stripe_account_id) return row.stripe_account_id as string;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    email: email ?? undefined,
    business_type: "individual",
    capabilities: { transfers: { requested: true } },
    business_profile: {
      product_description: "Window cleaning services booked through Vision",
    },
    metadata: { profile_id: profileId },
  });

  await admin.from("stripe_accounts").upsert({
    profile_id: profileId,
    stripe_account_id: account.id,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
  });

  return account.id;
}

/** Hosted onboarding link the cleaner follows to enter their payout details. */
export async function createOnboardingLink(
  accountId: string,
  baseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${baseUrl}/cleaner/payouts?refresh=1`,
    return_url: `${baseUrl}/cleaner/payouts?return=1`,
  });
  return link.url;
}

/** Link to the Stripe Express dashboard for an already-onboarded cleaner. */
export async function createExpressLoginLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

function toStatus(account: Stripe.Account): AccountStatus {
  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Read the cleaner's stored payout status. Does NOT call Stripe — cheap enough
 * for every page load. Use `syncConnectedAccount` to refresh from Stripe.
 */
export async function readAccountStatus(profileId: string): Promise<AccountStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data?.stripe_account_id) return EMPTY;
  return {
    accountId: data.stripe_account_id as string,
    chargesEnabled: Boolean(data.charges_enabled),
    payoutsEnabled: Boolean(data.payouts_enabled),
    detailsSubmitted: Boolean(data.details_submitted),
  };
}

/** Pull the latest status from Stripe and persist it. */
export async function syncConnectedAccount(
  profileId: string,
): Promise<AccountStatus> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!row?.stripe_account_id) return EMPTY;

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(row.stripe_account_id as string);
  await persistAccountStatus(account);
  return toStatus(account);
}

/** Store status from a Stripe Account object (used by the account.updated webhook). */
export async function persistAccountStatus(account: Stripe.Account): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("stripe_accounts")
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      onboarding_completed_at: account.details_submitted
        ? new Date().toISOString()
        : null,
    })
    .eq("stripe_account_id", account.id);
}
