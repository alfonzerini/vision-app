import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { stripeConfigured, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/env";
import { persistAccountStatus } from "@/lib/stripe/connect";
import { sweepDuePayouts } from "@/lib/stripe/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe signature verification needs the Node runtime (raw body + crypto).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeConfigured || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          stripe,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await persistAccountStatus(account);
        // A cleaner who just became payable may have funds waiting from jobs
        // that completed before they finished onboarding — release them now.
        if (account.payouts_enabled) {
          await sweepDuePayouts();
        }
        break;
      }
      default:
        // Other events are acknowledged but ignored.
        break;
    }
  } catch (err) {
    // Log and return 500 so Stripe retries later.
    console.error(`[stripe webhook] ${event.type} failed:`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  if (session.payment_status !== "paid") return;

  const quoteId = session.metadata?.quote_id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const amount = session.amount_total ?? 0;
  const currency = session.currency ?? "gbp";

  if (!quoteId || !paymentIntentId) {
    console.error("[stripe webhook] checkout session missing metadata", session.id);
    return;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_job_payment", {
    p_quote_id: quoteId,
    p_payment_intent: paymentIntentId,
    p_amount: amount,
    p_currency: currency,
  });

  if (error) {
    console.error("[stripe webhook] confirm_job_payment error:", error);
    throw error;
  }

  // The customer paid but the job was already taken (or the quote vanished) —
  // refund them automatically so no one is charged for nothing.
  if (data === "not_open" || data === "quote_missing") {
    await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `auto_refund_${paymentIntentId}` },
    );
    const customerId = session.metadata?.customer_id;
    if (customerId) {
      await admin.from("notifications").insert({
        user_id: customerId,
        type: "payment_released",
        title: "Payment refunded",
        body: "That job was no longer available, so your payment has been refunded.",
        data: { job_id: session.metadata?.job_id },
      });
    }
  }
}
