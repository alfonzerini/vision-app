import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionTile, StatChip } from "@/components/action-tile";

export const metadata: Metadata = { title: "My dashboard" };

export default async function CustomerDashboard() {
  const user = await requireRole("customer");
  const firstName = user.full_name?.split(" ")[0] ?? "there";
  const supabase = await createClient();

  const { data: jobRows } = await supabase.from("jobs").select("status");
  const jobs = (jobRows as { status: string }[] | null) ?? [];
  const active = jobs.filter((j) =>
    ["open", "assigned", "in_progress", "awaiting_review"].includes(j.status),
  ).length;
  const completed = jobs.filter((j) => j.status === "completed").length;

  return (
    <DashboardShell user={user}>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-medium text-white/80">Hi {firstName} 👋</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          Spotless windows, sorted.
        </h1>
        <p className="mt-1 max-w-md text-white/85">
          Post a job and trusted local cleaners will send you quotes to compare.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/customer/jobs/new"
            className="rounded-xl bg-white px-5 py-3 font-semibold text-brand-dark shadow transition-colors hover:bg-white/90"
          >
            + Post a new job
          </Link>
          {active > 0 && <StatChip>📋 {active} active</StatChip>}
          {completed > 0 && <StatChip>✅ {completed} completed</StatChip>}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ActionTile
          href="/customer/jobs"
          emoji="📋"
          title="My jobs"
          body="Track your active and past jobs"
          tint="bg-brand-light text-brand-dark"
        />
        <ActionTile
          href="/customer/jobs"
          emoji="💬"
          title="Messages"
          body="Chat with your cleaner on a job"
          tint="bg-purple-100 text-purple-700"
        />
        <ActionTile
          emoji="🏠"
          title="My properties"
          body="Manage your saved addresses"
          tint="bg-amber-100 text-amber-700"
          soon
        />
      </div>
    </DashboardShell>
  );
}
