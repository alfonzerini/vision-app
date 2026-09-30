import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { JOB_STATUS, CLEAN_TYPE_LABEL, formatDate } from "@/lib/display";
import type { CleanType, JobStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My jobs" };

interface JobRow {
  id: string;
  status: JobStatus;
  clean_type: CleanType;
  window_count: number | null;
  preferred_date: string | null;
  created_at: string;
  property: { address_line1: string; postcode: string } | null;
  quotes: { count: number }[];
}

export default async function MyJobsPage() {
  const user = await requireRole("customer");
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select(
      "id, status, clean_type, window_count, preferred_date, created_at, property:properties(address_line1, postcode), quotes(count)",
    )
    .order("created_at", { ascending: false });

  const jobs = (data as unknown as JobRow[]) ?? [];

  return (
    <DashboardShell user={user}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My jobs</h1>
        <Link
          href="/customer/jobs/new"
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Post a job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted">You haven&apos;t posted any jobs yet.</p>
          <Link
            href="/customer/jobs/new"
            className="mt-3 inline-block font-semibold text-brand underline"
          >
            Post your first job
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => {
            const status = JOB_STATUS[job.status];
            const quoteCount = job.quotes?.[0]?.count ?? 0;
            return (
              <li key={job.id}>
                <Link
                  href={`/customer/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand"
                >
                  <div>
                    <p className="font-semibold">
                      {job.property?.address_line1 ?? "Address"}
                      {job.property?.postcode ? `, ${job.property.postcode}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {CLEAN_TYPE_LABEL[job.clean_type]}
                      {job.window_count ? ` · ${job.window_count} windows` : ""}
                      {" · posted "}
                      {formatDate(job.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {job.status === "open" && (
                      <span className="text-xs text-muted">
                        {quoteCount} {quoteCount === 1 ? "quote" : "quotes"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
