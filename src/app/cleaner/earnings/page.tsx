import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { CLEAN_TYPE_LABEL, formatDate, formatMoney } from "@/lib/display";
import type { CleanType, JobStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Earnings" };

interface EarningJob {
  id: string;
  status: JobStatus;
  agreed_price_pence: number | null;
  completed_at: string | null;
  preferred_date: string | null;
  clean_type: CleanType;
  window_count: number | null;
}

/** Start of the current UK financial year (6 April). */
function financialYearStart(now = new Date()): Date {
  const year = now.getFullYear();
  const thisYearStart = new Date(year, 3, 6); // month 3 = April
  return now >= thisYearStart
    ? thisYearStart
    : new Date(year - 1, 3, 6);
}

export default async function EarningsPage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  // Commission rate (fraction, e.g. 0.15). Any authenticated user can read settings.
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "commission_rate")
    .single();
  const rate = Number(setting?.value ?? 0.15);

  const { data } = await supabase
    .from("jobs")
    .select(
      "id, status, agreed_price_pence, completed_at, preferred_date, clean_type, window_count",
    )
    .eq("assigned_cleaner_id", user.id)
    .order("completed_at", { ascending: false, nullsFirst: false });

  const jobs = (data as EarningJob[] | null) ?? [];

  // Cleaner's take-home = agreed price minus the platform fee (rounded per job).
  const net = (grossPence: number) =>
    grossPence - Math.round(grossPence * rate);

  const completed = jobs.filter(
    (j) => j.status === "completed" && j.agreed_price_pence != null,
  );
  // Work that's booked/underway or awaiting the customer's confirmation — money
  // you'll be paid once it's done, but not yet earned.
  const pipeline = jobs.filter(
    (j) =>
      ["assigned", "in_progress", "awaiting_review"].includes(j.status) &&
      j.agreed_price_pence != null,
  );

  const fyStart = financialYearStart();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const sumNet = (rows: EarningJob[]) =>
    rows.reduce((t, j) => t + net(j.agreed_price_pence ?? 0), 0);

  const totalEarned = sumNet(completed);
  const earnedThisMonth = sumNet(
    completed.filter((j) => j.completed_at && new Date(j.completed_at) >= monthStart),
  );
  const earnedThisFy = sumNet(
    completed.filter((j) => j.completed_at && new Date(j.completed_at) >= fyStart),
  );
  const pipelineTotal = sumNet(pipeline);

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Earnings</h1>
      <p className="mt-1 text-muted">
        Your take-home from completed jobs, after Vision&apos;s{" "}
        {Math.round(rate * 100)}% service fee.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Earned all-time" value={formatMoney(totalEarned)} big />
        <StatCard label="This month" value={formatMoney(earnedThisMonth)} />
        <StatCard
          label="This financial year"
          value={formatMoney(earnedThisFy)}
          hint={`Since ${formatDate(fyStart.toISOString())}`}
        />
        <StatCard
          label="In the pipeline"
          value={formatMoney(pipelineTotal)}
          hint={`${pipeline.length} booked ${pipeline.length === 1 ? "job" : "jobs"}`}
          muted
        />
      </div>

      {/* Payouts notice */}
      <div className="mt-6 rounded-xl border border-border bg-brand-light/60 p-4 text-sm">
        <p className="font-semibold text-brand-dark">About your earnings</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            Each figure is your share <strong>after the {Math.round(rate * 100)}% fee</strong>{" "}
            — the amount shown is yours to keep.
          </li>
          <li>
            Earnings are counted once a job is <strong>completed</strong> (the customer
            confirms, or 48 hours pass).
          </li>
          <li>Secure card payouts straight to your bank are launching soon.</li>
        </ul>
      </div>

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Coming up</h2>
          <p className="text-sm text-muted">
            Booked work you&apos;ll be paid for once it&apos;s completed.
          </p>
          <ul className="mt-3 space-y-3">
            {pipeline.map((j) => (
              <EarningRow key={j.id} job={j} net={net(j.agreed_price_pence ?? 0)} pending />
            ))}
          </ul>
        </section>
      )}

      {/* Completed / paid */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">Completed jobs</h2>
        {completed.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted">No completed jobs yet.</p>
            <Link
              href="/cleaner/jobs"
              className="mt-3 inline-block font-semibold text-brand underline"
            >
              Find jobs near you
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {completed.map((j) => (
              <EarningRow key={j.id} job={j} net={net(j.agreed_price_pence ?? 0)} />
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  big,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        big
          ? "border-brand bg-gradient-to-br from-brand to-brand-dark text-white"
          : muted
            ? "border-dashed border-border bg-card"
            : "border-border bg-card"
      }`}
    >
      <p className={`text-sm font-medium ${big ? "text-white/80" : "text-muted"}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-0.5 text-xs ${big ? "text-white/70" : "text-muted"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function EarningRow({
  job,
  net,
  pending,
}: {
  job: EarningJob;
  net: number;
  pending?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/cleaner/jobs/${job.id}`}
        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand"
      >
        <div className="min-w-0">
          <p className="font-semibold">
            {CLEAN_TYPE_LABEL[job.clean_type]}
            {job.window_count ? ` · ${job.window_count} windows` : ""}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {pending
              ? job.preferred_date
                ? `Booked for ${formatDate(job.preferred_date)}`
                : "Booked"
              : `Completed ${formatDate(job.completed_at)}`}
            {job.agreed_price_pence != null &&
              ` · ${formatMoney(job.agreed_price_pence)} job`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums">{formatMoney(net)}</p>
          <p className="text-xs text-muted">{pending ? "expected" : "earned"}</p>
        </div>
      </Link>
    </li>
  );
}
