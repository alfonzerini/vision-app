import "server-only";
import { getStripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/display";

/**
 * Create a hosted Stripe Checkout Session for a customer to pay for a quote.
 * The charge lands in the platform balance (escrow). The cleaner is assigned
 * and the payment recorded only once the webhook confirms payment.
 */
export async function createQuoteCheckout(opts: {
  quoteId: string;
  jobId: string;
  customerId: string;
  cleanerId: string;
  amountPence: number;
  cleanerName: string;
  customerEmail?: string;
  baseUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const metadata = {
    quote_id: opts.quoteId,
    job_id: opts.jobId,
    customer_id: opts.customerId,
    cleaner_id: opts.cleanerId,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: opts.amountPence,
          product_data: {
            name: `Window cleaning — ${opts.cleanerName}`,
            description: "Held securely by Vision until the job is complete.",
          },
        },
      },
    ],
    payment_intent_data: {
      transfer_group: opts.jobId,
      metadata,
    },
    metadata,
    success_url: `${opts.baseUrl}/customer/jobs/${opts.jobId}?paid=1`,
    cancel_url: `${opts.baseUrl}/customer/jobs/${opts.jobId}?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export type ReleaseResult =
  | "released"
  | "already_released"
  | "no_payment"
  | "no_account";

/**
 * Release a held payment to the cleaner (85%) via a Stripe Transfer, keeping
 * the platform fee. Safe to call more than once (idempotent on the transfer).
 * If the cleaner hasn't finished payout onboarding, the funds stay held and
 * this returns "no_account" — the sweeper retries later.
 */
export async function releaseJobPayout(jobId: string): Promise<ReleaseResult> {
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, cleaner_id, cleaner_amount_pence, currency, status")
    .eq("job_id", jobId)
    .maybeSingle();

  if (!pay) return "no_payment";
  if (pay.status === "released") return "already_released";
  if (pay.status !== "held") return "no_payment"; // refunded / failed

  const { data: acct } = await admin
    .from("stripe_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("profile_id", pay.cleaner_id)
    .maybeSingle();

  if (!acct?.stripe_account_id || !acct.payouts_enabled) return "no_account";

  const stripe = getStripe();
  const transfer = await stripe.transfers.create(
    {
      amount: pay.cleaner_amount_pence,
      currency: pay.currency,
      destination: acct.stripe_account_id as string,
      transfer_group: jobId,
      metadata: { job_id: jobId, payment_id: pay.id },
    },
    { idempotencyKey: `release_${pay.id}` },
  );

  await admin
    .from("payments")
    .update({
      status: "released",
      stripe_transfer_id: transfer.id,
      released_at: new Date().toISOString(),
    })
    .eq("id", pay.id);

  await admin.from("notifications").insert({
    user_id: pay.cleaner_id,
    type: "payment_released",
    title: "You've been paid",
    body: `${formatMoney(pay.cleaner_amount_pence)} is on its way to your bank account.`,
    data: { job_id: jobId },
  });

  return "released";
}

/**
 * Release every held payment whose job is already completed and whose cleaner
 * can now be paid. Covers the 48-hour auto-complete path and cleaners who
 * finished payout onboarding after winning a job. Idempotent. Optionally
 * limited to one cleaner. Returns how many were released this run.
 */
export async function sweepDuePayouts(cleanerId?: string): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("payments")
    .select("job_id, jobs(status)")
    .eq("status", "held");
  if (cleanerId) query = query.eq("cleaner_id", cleanerId);

  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    job_id: string;
    jobs: { status: string } | { status: string }[] | null;
  }[];

  let released = 0;
  for (const r of rows) {
    const job = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
    if (job?.status === "completed") {
      const res = await releaseJobPayout(r.job_id);
      if (res === "released") released++;
    }
  }
  return released;
}

export type RefundResult = "refunded" | "already_refunded" | "no_payment";

/**
 * Refund a held payment back to the customer (e.g. an upheld dispute). Only
 * possible while funds are still held — once released to the cleaner it can't
 * be clawed back here. Idempotent.
 */
export async function refundJobPayment(jobId: string): Promise<RefundResult> {
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("id, customer_id, status, stripe_payment_intent_id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (!pay) return "no_payment";
  if (pay.status === "refunded") return "already_refunded";
  if (pay.status !== "held" || !pay.stripe_payment_intent_id) return "no_payment";

  const stripe = getStripe();
  await stripe.refunds.create(
    { payment_intent: pay.stripe_payment_intent_id as string },
    { idempotencyKey: `refund_${pay.id}` },
  );

  await admin
    .from("payments")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", pay.id);

  await admin.from("notifications").insert({
    user_id: pay.customer_id,
    type: "payment_released",
    title: "Payment refunded",
    body: "Your payment has been refunded. It may take a few days to appear.",
    data: { job_id: jobId },
  });

  return "refunded";
}
