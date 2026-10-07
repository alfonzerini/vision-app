/**
 * Plain-English explainer of how payment & completion works, shown before a
 * customer posts/accepts and before a cleaner quotes. Sets expectations about
 * escrow, the 48-hour auto-complete, and (for customers) reporting a problem.
 *
 * Secure payments aren't live yet — the copy notes that — but the completion
 * and 48-hour rules already apply.
 */
export function PaymentNotice({ role }: { role: "customer" | "cleaner" }) {
  return (
    <div className="rounded-xl border border-border bg-brand-light/60 p-4 text-sm">
      <p className="font-semibold text-brand-dark">How payment &amp; completion works</p>
      {role === "customer" ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>When you accept a quote, your payment is held securely — never paid straight to the cleaner.</li>
          <li>It&apos;s released only once <strong>you confirm the job is done</strong>, or automatically <strong>48 hours</strong> after the cleaner marks it complete if you don&apos;t respond.</li>
          <li>If something&apos;s wrong, you can <strong>report a problem</strong> instead of confirming, and the payment stays on hold while we look into it.</li>
        </ul>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Once a customer accepts your quote, their payment is held securely.</li>
          <li>You&apos;re paid after they <strong>confirm the job is done</strong>, or automatically <strong>48 hours</strong> after you mark it complete if they don&apos;t respond.</li>
          <li>Completing a job needs at least 3 after-photos and that you&apos;re at the property.</li>
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Secure card payments are launching soon.</p>
    </div>
  );
}
