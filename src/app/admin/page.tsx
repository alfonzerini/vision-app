import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDashboard, type AdminStats } from "@/components/admin-dashboard";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_stats");
  const stats = data as AdminStats | null;

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <p className="mt-1 text-muted">Platform usage and commission at a glance.</p>

      <div className="mt-8">
        {stats ? (
          <AdminDashboard stats={stats} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            Couldn&apos;t load stats{error ? ` (${error.message})` : ""}.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
