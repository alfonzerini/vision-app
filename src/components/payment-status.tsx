import Link from "next/link";
import { formatMoney } from "@/lib/display";

export type PayRowStatus =
  | "requires_payment"
  | "held"
  | "released"
  | "refunded"
  | "partially_refunded"
  | "failed";

/**
 * Shows the money state of a job to the customer or the assigned cleaner.
 * Reads from the job's payments row (held / released / refunded).
 */
export function PaymentStatusCard({
  role,
  status,
  amountPence,
  cleanerAmountPence,
  payoutsReady = true,
}: {
  role: "customer" | "cleaner";
  status: PayRowStatus;
  amountPence: number;
  cleanerAmountPence: number;
  payoutsReady?: boolean;
}) {
  const tint =
    status === "released"
      ? "border-emerald-300 bg-emerald-50"
      : status === "refunded"
        ? "border-border bg-card"
        : "border-brand/40 bg-brand-light/50";

  let emoji = "💳";
  let title = "";
  let body = "";

  if (role === "customer") {
    if (status === "held") {
      emoji = "🔒";
      title = "Payment held securely";
      body = `${formatMoney(amountPence)} is held and released to your cleaner once the job is complete.`;
    } else if (status === "released") {
      emoji = "✅";
      title = "Payment released";
      body = `${formatMoney(amountPence)} has been released to your cleaner. Thank you!`;
    } else if (status === "refunded") {
      emoji = "↩️";
      title = "Payment refunded";
      body = `${formatMoney(amountPence)} has been refunded to you.`;
    } else return null;
  } else {
    if (status === "held") {
      emoji = "🔒";
      title = "Payment secured";
      body = `You'll receive ${formatMoney(cleanerAmountPence)} when the job is confirmed complete.`;
    } else if (status === "released") {
      emoji = "💷";
      title = "You've been paid";
      body = `${formatMoney(cleanerAmountPence)} is on its way to your bank account.`;
    } else if (status === "refunded") {
      emoji = "↩️";
      title = "Payment refunded to the customer";
      body = "This job's payment was refunded, so there's nothing to pay out.";
    } else return null;
  }

  return (
    <section className={`mt-6 rounded-2xl border p-5 shadow-sm ${tint}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{body}</p>
          {role === "cleaner" && status === "held" && !payoutsReady && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              ⚠️ {" "}
              <Link href="/cleaner/payouts" className="underline">
                Set up your payouts
              </Link>{" "}
              so we can send this to your bank.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
