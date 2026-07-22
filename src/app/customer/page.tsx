import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell, FeatureCard } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "My dashboard" };

export default async function CustomerDashboard() {
  const user = await requireRole("customer");
  const firstName = user.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Hi {firstName} 👋</h1>
      <p className="mt-1 text-muted">
        Ready to get your windows sparkling? Post a job and local cleaners will
        send you quotes.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <FeatureCard title="Post a new job" body="Tell us what needs cleaning and get quotes. (Coming next.)" />
        <FeatureCard title="My jobs" body="Track your active and past jobs." />
        <FeatureCard title="Messages" body="Chat with cleaners about access and timings." />
        <FeatureCard title="My properties" body="Manage the addresses you book cleaning for." />
      </div>
    </DashboardShell>
  );
}
