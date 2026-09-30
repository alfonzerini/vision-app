import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { JOB_STATUS, CLEAN_TYPE_LABEL, formatDate } from "@/lib/display";
import type { CleanType, JobStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Job details" };

interface JobDetail {
  id: string;
  status: JobStatus;
  clean_type: CleanType;
  window_count: number | null;
  has_conservatory: boolean;
  has_skylights: boolean;
  has_solar_panels: boolean;
  has_veranda: boolean;
  preferred_date: string | null;
  preferred_time: string | null;
  access_notes: string | null;
  additional_notes: string | null;
  created_at: string;
  property: {
    address_line1: string;
    address_line2: string | null;
    city: string | null;
    postcode: string;
  } | null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("customer");
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select(
      "id, status, clean_type, window_count, has_conservatory, has_skylights, has_solar_panels, has_veranda, preferred_date, preferred_time, access_notes, additional_notes, created_at, property:properties(address_line1, address_line2, city, postcode)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const job = data as unknown as JobDetail;
  const status = JOB_STATUS[job.status];

  const extras = [
    job.has_conservatory && "Conservatory",
    job.has_skylights && "Skylights",
    job.has_solar_panels && "Solar panels",
    job.has_veranda && "Veranda / porch",
  ].filter(Boolean) as string[];

  return (
    <DashboardShell user={user}>
      <Link
        href="/customer/jobs"
        className="text-sm font-medium text-brand hover:underline"
      >
        ← All my jobs
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {job.property?.address_line1}
          {job.property?.postcode ? `, ${job.property.postcode}` : ""}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">Posted {formatDate(job.created_at)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Job details */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold">Job details</h2>
          <dl className="mt-3 text-sm">
            <DetailRow label="Windows" value={CLEAN_TYPE_LABEL[job.clean_type]} />
            <DetailRow
              label="Number of windows"
              value={job.window_count ?? "Not specified"}
            />
            <DetailRow
              label="Extras"
              value={extras.length ? extras.join(", ") : "None"}
            />
            <DetailRow
              label="Preferred date"
              value={formatDate(job.preferred_date)}
            />
            <DetailRow
              label="Preferred time"
              value={job.preferred_time ?? "Anytime"}
            />
          </dl>
          {job.additional_notes && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Notes</p>
              <p className="mt-1 text-sm text-muted">{job.additional_notes}</p>
            </div>
          )}
          <div className="mt-4 text-sm">
            <p className="font-semibold">Address</p>
            <p className="mt-1 text-muted">
              {[
                job.property?.address_line1,
                job.property?.address_line2,
                job.property?.city,
                job.property?.postcode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </section>

        {/* Quotes */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold">Quotes</h2>
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            {job.status === "open"
              ? "No quotes yet. Local cleaners will send prices soon — you'll be notified."
              : "Quotes will appear here."}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
