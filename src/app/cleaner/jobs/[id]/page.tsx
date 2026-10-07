import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaymentNotice } from "@/components/payment-notice";
import {
  CLEAN_TYPE_LABEL,
  JOB_STATUS,
  formatDate,
  formatDistance,
  formatMoney,
} from "@/lib/display";
import type { CleanType, JobStatus, QuoteStatus } from "@/lib/types";
import { SETTINGS_DEFAULTS } from "@/lib/config";
import { QuoteForm } from "./quote-form";
import { CompletionPanel } from "./completion-panel";

export const metadata: Metadata = { title: "Job details" };

interface JobAddress {
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postcode: string;
  access_notes: string | null;
}

interface CleanerJobView {
  id: string;
  status: JobStatus;
  clean_type: CleanType;
  window_count: number | null;
  has_conservatory: boolean;
  has_skylights: boolean;
  has_solar_panels: boolean;
  has_veranda: boolean;
  additional_notes: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at: string;
  city: string | null;
  postcode_area: string | null;
  distance_m: number | null;
  my_quote_id: string | null;
  my_quote_amount_pence: number | null;
  my_quote_status: QuoteStatus | null;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function CleanerJobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("cleaner");
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("job_for_cleaner", { p_job_id: id });
  const job = ((data as CleanerJobView[] | null) ?? [])[0];
  if (!job) notFound();

  const iWon = job.my_quote_status === "accepted";
  const status = JOB_STATUS[job.status];

  const extras = [
    job.has_conservatory && "Conservatory",
    job.has_skylights && "Skylights",
    job.has_solar_panels && "Solar panels",
    job.has_veranda && "Veranda / porch",
  ].filter(Boolean) as string[];

  // If this cleaner won the job, they may now see the full address.
  let address: JobAddress | null = null;
  if (iWon) {
    const { data: jobRow } = await supabase
      .from("jobs")
      .select(
        "access_notes, property:properties(address_line1, address_line2, city, postcode, access_notes)",
      )
      .eq("id", id)
      .maybeSingle();
    address =
      (jobRow as { property: JobAddress | null } | null)?.property ?? null;
  }

  // Load any completion photos (private bucket → short-lived signed URLs).
  let photos: { id: string; url: string }[] = [];
  if (iWon) {
    const { data: ev } = await supabase
      .from("completion_evidence")
      .select("id, file_path")
      .eq("job_id", id)
      .eq("kind", "after")
      .order("created_at");
    const rows = (ev as { id: string; file_path: string }[] | null) ?? [];
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from("job-media")
        .createSignedUrls(
          rows.map((r) => r.file_path),
          3600,
        );
      photos = rows.map((r, i) => ({
        id: r.id,
        url: signed?.[i]?.signedUrl ?? "",
      })).filter((p) => p.url);
    }
  }

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {CLEAN_TYPE_LABEL[job.clean_type]}
          {job.city ? ` · ${job.city}` : job.postcode_area ? ` · ${job.postcode_area}` : ""}
        </h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatDistance(job.distance_m)} away · posted {formatDate(job.created_at)}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Job details */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold">Job details</h2>
          <dl className="mt-3 text-sm">
            <Detail label="Windows" value={CLEAN_TYPE_LABEL[job.clean_type]} />
            <Detail label="Number of windows" value={job.window_count ?? "Not specified"} />
            <Detail label="Extras" value={extras.length ? extras.join(", ") : "None"} />
            <Detail label="Preferred date" value={formatDate(job.preferred_date)} />
            <Detail label="Preferred time" value={job.preferred_time ?? "Anytime"} />
            <Detail label="Area" value={job.postcode_area ?? job.city ?? "Nearby"} />
          </dl>
          {job.additional_notes && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Customer notes</p>
              <p className="mt-1 text-sm text-muted">{job.additional_notes}</p>
            </div>
          )}
        </section>

        {/* Quote / status panel */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {iWon && address ? (
            <>
              <h2 className="text-lg font-bold text-emerald-700">You won this job! 🎉</h2>
              <p className="mt-1 text-sm text-muted">
                Agreed price {job.my_quote_amount_pence != null ? formatMoney(job.my_quote_amount_pence) : ""}.
              </p>
              <div className="mt-4 text-sm">
                <p className="font-semibold">Address</p>
                <p className="mt-1 text-muted">
                  {[address.address_line1, address.address_line2, address.city, address.postcode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              {address.access_notes && (
                <div className="mt-3 text-sm">
                  <p className="font-semibold">Access notes</p>
                  <p className="mt-1 text-muted">{address.access_notes}</p>
                </div>
              )}

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="font-bold">
                  {job.status === "completed"
                    ? "Job complete ✅"
                    : job.status === "awaiting_review"
                      ? "Submitted for review"
                      : "Finish the job"}
                </h3>
                <p className="mt-1 mb-3 text-sm text-muted">
                  {job.status === "completed"
                    ? `The customer confirmed the job — you've earned ${
                        job.my_quote_amount_pence != null
                          ? formatMoney(job.my_quote_amount_pence)
                          : "your quoted amount"
                      }.`
                    : job.status === "awaiting_review"
                      ? "Waiting for the customer to confirm — they've been notified."
                      : "Upload your after-photos and mark the job complete when you're on site."}
                </p>
                <CompletionPanel
                  jobId={job.id}
                  cleanerId={user.id}
                  status={job.status}
                  initialPhotos={photos}
                  minPhotos={SETTINGS_DEFAULTS.min_after_photos}
                />
              </div>
            </>
          ) : job.status === "open" ? (
            <>
              <h2 className="text-lg font-bold">
                {job.my_quote_id ? "Your quote" : "Send a quote"}
              </h2>
              <p className="mt-1 mb-4 text-sm text-muted">
                {job.my_quote_id
                  ? "You've quoted for this job. You can update it below."
                  : "Give the customer your price. They'll compare quotes and choose."}
              </p>
              <QuoteForm jobId={job.id} existingAmountPence={job.my_quote_amount_pence} />
              <div className="mt-4">
                <PaymentNotice role="cleaner" />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">This job is no longer open</h2>
              <p className="mt-1 text-sm text-muted">
                {job.my_quote_status === "rejected"
                  ? "The customer chose another cleaner this time."
                  : "This job has been booked."}
              </p>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
