"use client";

import { useMemo, useState } from "react";
import { startOfWeek, format } from "date-fns";
import { formatMoney } from "@/lib/display";

export interface AdminStats {
  commission_rate: number;
  fy_start: string;
  counts: { customers: number; cleaners: number };
  jobs: {
    total: number;
    open: number;
    active: number;
    completed: number;
    disputed: number;
  };
  commission: {
    today: number;
    week: number;
    month: number;
    fy: number;
    all: number;
  };
  daily: { d: string; jobs: number; commission: number }[];
  monthly: { m: string; jobs: number; commission: number }[];
}

type View = "daily" | "weekly" | "monthly" | "fy";

interface Bar {
  label: string;
  value: number;
  jobs: number;
}

export function AdminDashboard({ stats }: { stats: AdminStats }) {
  const [view, setView] = useState<View>("monthly");

  const bars: Bar[] = useMemo(() => {
    const daily = stats.daily.map((x) => ({ ...x, commission: Number(x.commission) }));
    const monthly = stats.monthly.map((x) => ({ ...x, commission: Number(x.commission) }));

    if (view === "daily") {
      return daily.slice(-30).map((x) => ({
        label: format(new Date(x.d), "d MMM"),
        value: x.commission,
        jobs: x.jobs,
      }));
    }
    if (view === "weekly") {
      const byWeek = new Map<string, Bar>();
      for (const x of daily) {
        const ws = startOfWeek(new Date(x.d), { weekStartsOn: 1 });
        const key = format(ws, "yyyy-MM-dd");
        const cur = byWeek.get(key) ?? { label: format(ws, "d MMM"), value: 0, jobs: 0 };
        cur.value += x.commission;
        cur.jobs += x.jobs;
        byWeek.set(key, cur);
      }
      return [...byWeek.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-12)
        .map(([, v]) => v);
    }
    const fyStartMonth = stats.fy_start.slice(0, 7);
    const months = view === "fy" ? monthly.filter((x) => x.m >= fyStartMonth) : monthly;
    return months.map((x) => ({
      label: format(new Date(x.m + "-01"), "MMM yy"),
      value: x.commission,
      jobs: x.jobs,
    }));
  }, [view, stats]);

  const max = Math.max(1, ...bars.map((b) => b.value));
  const totalShown = bars.reduce((s, b) => s + b.value, 0);
  const showLabels = bars.length <= 13;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Customers" value={stats.counts.customers} tint="brand" />
        <Kpi label="Cleaners" value={stats.counts.cleaners} tint="brand" />
        <Kpi
          label="Jobs completed"
          value={stats.jobs.completed}
          sub={`${stats.jobs.total} posted in total`}
        />
        <Kpi
          label="Commission (FY to date)"
          value={formatMoney(stats.commission.fy)}
          sub={`${formatMoney(stats.commission.all)} all-time`}
          tint="accent"
        />
      </div>

      {/* Commission windows */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Today" value={formatMoney(stats.commission.today)} />
        <Mini label="This week" value={formatMoney(stats.commission.week)} />
        <Mini label="This month" value={formatMoney(stats.commission.month)} />
        <Mini label="Financial year" value={formatMoney(stats.commission.fy)} />
      </div>

      {/* Commission chart */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Commission earned</h2>
            <p className="text-sm text-muted">
              Your {Math.round(stats.commission_rate * 100)}% of completed jobs ·{" "}
              {formatMoney(totalShown)} shown
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-border p-0.5 text-sm">
            {(
              [
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["fy", "Financial year"],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  view === v ? "bg-brand text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {totalShown === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No commission in this period yet.
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-1 text-xs text-muted">Max {formatMoney(max)}</p>
            <div className="flex h-56 items-end gap-1.5 border-b border-border">
              {bars.map((b, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center justify-end">
                  {showLabels && (
                    <span className="mb-1 text-[10px] font-medium text-muted opacity-0 group-hover:opacity-100">
                      {formatMoney(b.value)}
                    </span>
                  )}
                  <div
                    title={`${b.label}: ${formatMoney(b.value)} · ${b.jobs} job${b.jobs === 1 ? "" : "s"}`}
                    className="w-full rounded-t bg-gradient-to-t from-brand-dark to-brand transition-opacity hover:opacity-80"
                    style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              {bars.map((b, i) => (
                <span
                  key={i}
                  className="flex-1 truncate text-center text-[10px] text-muted"
                >
                  {showLabels || i % 5 === 0 ? b.label : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Jobs by status */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold">Jobs by status</h2>
        <div className="mt-4 space-y-2.5">
          <StatusBar label="Open for quotes" value={stats.jobs.open} total={stats.jobs.total} className="bg-brand" />
          <StatusBar label="In progress" value={stats.jobs.active} total={stats.jobs.total} className="bg-amber-500" />
          <StatusBar label="Completed" value={stats.jobs.completed} total={stats.jobs.total} className="bg-emerald-500" />
          <StatusBar label="Disputed" value={stats.jobs.disputed} total={stats.jobs.total} className="bg-red-500" />
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tint?: "brand" | "accent";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        tint === "accent"
          ? "border-accent/40 bg-accent/10"
          : tint === "brand"
            ? "border-brand/30 bg-brand-light"
            : "border-border bg-card"
      }`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function StatusBar({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-muted">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-semibold">{value}</span>
    </div>
  );
}
