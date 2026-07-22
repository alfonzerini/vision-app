import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell, FeatureCard } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const user = await requireRole("admin");

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-1 text-muted">
        Platform overview and moderation tools.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard title="Users" body="Customers and cleaners; suspend if needed." />
        <FeatureCard title="Cleaner approvals" body="Verify insurance & ID documents." />
        <FeatureCard title="Jobs" body="Every job across the platform." />
        <FeatureCard title="Payments & payouts" body="Escrow, releases and refunds." />
        <FeatureCard title="Disputes" body="Review and resolve disputed jobs." />
        <FeatureCard title="Settings" body="Commission, review window, GPS radius." />
      </div>
    </DashboardShell>
  );
}
