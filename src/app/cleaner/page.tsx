import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell, FeatureCard } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Cleaner dashboard" };

export default async function CleanerDashboard() {
  const user = await requireRole("cleaner");
  const firstName = user.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Welcome, {firstName} 🧽</h1>
      <p className="mt-1 text-muted">
        Find window-cleaning jobs near you, send quotes, and get paid quickly
        once the work is done.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <FeatureCard title="Jobs near me" body="Browse open jobs in your coverage area. (Coming next.)" />
        <FeatureCard title="My quotes" body="See the quotes you've sent and their status." />
        <FeatureCard title="My schedule" body="Your upcoming assigned jobs." />
        <FeatureCard title="Earnings" body="Track payments and payouts." />
        <FeatureCard title="My profile" body="Business details, insurance, coverage & services." />
        <FeatureCard title="Get verified" body="Upload your insurance and ID to start receiving jobs." />
      </div>
    </DashboardShell>
  );
}
