import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { PropertyForm } from "../property-form";

export const metadata: Metadata = { title: "Add address" };

export default async function NewPropertyPage() {
  const user = await requireRole("customer");

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Add an address</h1>
      <p className="mt-1 text-muted">
        Save it once and it&apos;ll be ready to pick next time you post a job.
      </p>
      <div className="mt-6 max-w-2xl">
        <PropertyForm />
      </div>
    </DashboardShell>
  );
}
