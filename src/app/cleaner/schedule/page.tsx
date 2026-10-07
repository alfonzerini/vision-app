import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView, type ScheduleJob } from "@/components/schedule-view";
import type { CleanType, JobStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My schedule" };

interface JobRow {
  id: string;
  status: JobStatus;
  clean_type: CleanType;
  window_count: number | null;
  preferred_date: string | null;
  preferred_time: string | null;
  property: { city: string | null; postcode: string } | null;
}

export default async function SchedulePage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select(
      "id, status, clean_type, window_count, preferred_date, preferred_time, property:properties(city, postcode)",
    )
    .eq("assigned_cleaner_id", user.id)
    .order("preferred_date", { ascending: true });

  const rows = (data as unknown as JobRow[]) ?? [];
  const jobs: ScheduleJob[] = rows.map((j) => ({
    id: j.id,
    status: j.status,
    clean_type: j.clean_type,
    window_count: j.window_count,
    preferred_date: j.preferred_date,
    preferred_time: j.preferred_time,
    area: j.property?.city ?? j.property?.postcode ?? null,
  }));

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">My schedule</h1>
      <p className="mt-1 text-muted">
        Your booked jobs — switch between month, week, day and list views.
      </p>
      <div className="mt-6">
        <ScheduleView jobs={jobs} />
      </div>
    </DashboardShell>
  );
}
