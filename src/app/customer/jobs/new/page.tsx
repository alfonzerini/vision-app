import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { NewJobForm, type SavedProperty } from "./new-job-form";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireRole("customer");
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, label, address_line1, postcode")
    .order("created_at", { ascending: false });

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Post a window cleaning job</h1>
      <p className="mt-1 text-muted">
        Fill this in and local cleaners will send you quotes. It only takes a
        minute.
      </p>

      <div className="mt-8 max-w-2xl">
        <NewJobForm properties={(properties as SavedProperty[]) ?? []} />
      </div>
    </DashboardShell>
  );
}
