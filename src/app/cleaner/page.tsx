import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionTile, StatChip } from "@/components/action-tile";

export const metadata: Metadata = { title: "Cleaner dashboard" };

export default async function CleanerDashboard() {
  const user = await requireRole("cleaner");
  const firstName = user.full_name?.split(" ")[0] ?? "there";
  const supabase = await createClient();

  const { data: cp } = await supabase
    .from("cleaner_profiles")
    .select("avg_rating, rating_count, completed_jobs")
    .eq("profile_id", user.id)
    .single();
  const { data: nearby } = await supabase.rpc("jobs_near_me");

  const rating = Number(cp?.avg_rating ?? 0);
  const ratingCount = cp?.rating_count ?? 0;
  const completed = cp?.completed_jobs ?? 0;
  const nearbyCount = (nearby as unknown[] | null)?.length ?? 0;

  return (
    <DashboardShell user={user}>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-medium text-white/80">Welcome, {firstName} 🧽</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          Let&apos;s find you work.
        </h1>
        <p className="mt-1 max-w-md text-white/85">
          Browse jobs near you, send quotes, and get paid once the work&apos;s done.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/cleaner/jobs"
            className="rounded-xl bg-white px-5 py-3 font-semibold text-brand-dark shadow transition-colors hover:bg-white/90"
          >
            📍 Find jobs near me
          </Link>
          <StatChip>★ {ratingCount > 0 ? rating.toFixed(1) : "New"}</StatChip>
          {completed > 0 && <StatChip>✅ {completed} done</StatChip>}
          {nearbyCount > 0 && <StatChip>📍 {nearbyCount} near you</StatChip>}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ActionTile
          href="/cleaner/quotes"
          emoji="💷"
          title="My quotes"
          body="Quotes you've sent and their status"
          tint="bg-brand-light text-brand-dark"
        />
        <ActionTile
          href="/cleaner/schedule"
          emoji="📅"
          title="My schedule"
          body="Your booked jobs, calendar or list"
          tint="bg-purple-100 text-purple-700"
        />
        <ActionTile
          href="/cleaner/coverage"
          emoji="👤"
          title="My profile & coverage"
          body="Business details, photo, rating & area"
          tint="bg-emerald-100 text-emerald-700"
        />
        <ActionTile
          href="/cleaner/coverage"
          emoji="🛡️"
          title="Get verified"
          body="Upload your insurance & ID"
          tint="bg-amber-100 text-amber-700"
        />
        <ActionTile
          href="/cleaner/earnings"
          emoji="📈"
          title="Earnings"
          body="Track payments and payouts"
          tint="bg-slate-100 text-slate-600"
        />
        <ActionTile
          href="/cleaner/payouts"
          emoji="🏦"
          title="Payouts"
          body="Connect your bank to get paid"
          tint="bg-brand-light text-brand-dark"
        />
      </div>
    </DashboardShell>
  );
}
