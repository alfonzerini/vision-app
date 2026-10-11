import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubmitButton } from "@/components/submit-button";
import { stripeConfigured } from "@/lib/stripe/env";
import {
  readAccountStatus,
  syncConnectedAccount,
  type AccountStatus,
} from "@/lib/stripe/connect";
import { startPayoutOnboarding, openExpressDashboard } from "./actions";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; refresh?: string; error?: string }>;
}) {
  const user = await requireRole("cleaner");
  const sp = await searchParams;

  // Payments not switched on yet — show a friendly placeholder.
  if (!stripeConfigured) {
    return (
      <DashboardShell user={user}>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <div className="mt-6 max-w-xl rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🏦
          </p>
          <p className="mt-3 font-semibold">Payouts are launching soon</p>
          <p className="mt-1 text-sm text-muted">
            You&apos;ll be able to connect your bank account here to get paid
            automatically when a job is complete.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // Coming back from Stripe onboarding → refresh the stored status from Stripe.
  const status: AccountStatus =
    sp.return || sp.refresh
      ? await syncConnectedAccount(user.id)
      : await readAccountStatus(user.id);

  const ready = status.payoutsEnabled && status.detailsSubmitted;
  const started = Boolean(status.accountId);
  const inProgress = started && !ready;

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Payouts</h1>
      <p className="mt-1 text-muted">
        Connect your bank account so your earnings reach you automatically.
      </p>

      {sp.error === "unavailable" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Payments aren&apos;t available just yet. Please try again later.
        </p>
      )}

      {/* Status card */}
      <div className="mt-6 max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
              ready
                ? "bg-emerald-100 text-emerald-700"
                : inProgress
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            }`}
            aria-hidden
          >
            {ready ? "✅" : inProgress ? "⏳" : "🏦"}
          </span>
          <div>
            <p className="font-semibold">
              {ready
                ? "You're set up to get paid"
                : inProgress
                  ? "Almost there"
                  : "Set up payouts"}
            </p>
            <p className="text-sm text-muted">
              {ready
                ? "Your payout details are complete."
                : inProgress
                  ? "Stripe still needs a few details before you can be paid."
                  : "It takes a couple of minutes, handled securely by Stripe."}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {ready ? (
            <form action={openExpressDashboard}>
              <button
                type="submit"
                className="rounded-xl border border-border px-5 py-3 font-semibold transition-colors hover:bg-brand-light"
              >
                Manage payout details
              </button>
            </form>
          ) : (
            <form action={startPayoutOnboarding}>
              <SubmitButton>
                {inProgress ? "Finish setting up" : "Set up payouts"}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-border bg-brand-light/60 p-4 text-sm">
        <p className="font-semibold text-brand-dark">How payouts work</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>You can still quote and win jobs before setting this up.</li>
          <li>
            When a job is completed, your 85% share is sent to your bank. If your
            payout details aren&apos;t ready yet, the money is held safely and
            paid as soon as they are.
          </li>
          <li>Bank details are handled by Stripe — Vision never sees them.</li>
        </ul>
      </div>
    </DashboardShell>
  );
}
