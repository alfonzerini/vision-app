import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaymentNotice } from "@/components/payment-notice";
import {
  JOB_STATUS,
  QUOTE_STATUS,
  CLEAN_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "@/lib/display";
import type { CleanType, JobStatus, QuoteStatus } from "@/lib/types";
import { acceptQuote, confirmCompletion } from "../actions";

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

interface QuoteView {
  quote_id: string;
  amount_pence: number;
  message: string | null;
  status: QuoteStatus;
  created_at: string;
  cleaner_id: string;
  business_name: string;
  avg_rating: number;
  rating_count: number;
  completed_jobs: number;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Rating({ avg, count }: { avg: number; count: number }) {
  if (!count) {
    return <span className="text-xs font-medium text-muted">New cleaner</span>;
  }
  return (
    <span className="text-xs font-medium text-muted">
      ★ {avg.toFixed(1)} ({count})
    </span>
  );
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    accepted?: string;
    error?: string;
    confirmed?: string;
    reported?: string;
  }>;
}) {
  const user = await requireRole("customer");
  const { id } = await params;
  const { accepted, error, confirmed, reported } = await searchParams;
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

  const { data: quotesData } = await supabase.rpc("quotes_for_job", {
    p_job_id: id,
  });
  const quotes = (quotesData as QuoteView[] | null) ?? [];

  // Load completion photos once the cleaner has submitted them.
  let photos: { id: string; url: string }[] = [];
  if (job.status === "awaiting_review" || job.status === "completed") {
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
      photos = rows
        .map((r, i) => ({ id: r.id, url: signed?.[i]?.signedUrl ?? "" }))
        .filter((p) => p.url);
    }
  }

  const extras = [
    job.has_conservatory && "Conservatory",
    job.has_skylights && "Skylights",
    job.has_solar_panels && "Solar panels",
    job.has_veranda && "Veranda / porch",
  ].filter(Boolean) as string[];

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {accepted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Quote accepted — your cleaner is booked. We&apos;ve let them know.
        </p>
      )}
      {error === "accept" && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Sorry, we couldn&apos;t accept that quote — it may no longer be
          available. Please try another.
        </p>
      )}
      {confirmed && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Thanks — you&apos;ve confirmed the job is complete.
        </p>
      )}
      {error === "confirm" && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Sorry, we couldn&apos;t confirm that just now. Please try again.
        </p>
      )}
      {reported && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Thanks — we&apos;ve received your report and will look into it.
        </p>
      )}

      {job.status === "open" && (
        <div className="mt-6">
          <PaymentNotice role="customer" />
        </div>
      )}

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
          <h2 className="text-lg font-bold">
            Quotes {quotes.length > 0 && `(${quotes.length})`}
          </h2>

          {quotes.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              {job.status === "open"
                ? "No quotes yet. Local cleaners will send prices soon — you'll be notified."
                : "No quotes were received."}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {quotes.map((q) => {
                const qs = QUOTE_STATUS[q.status];
                const isAccepted = q.status === "accepted";
                return (
                  <li
                    key={q.quote_id}
                    className={`rounded-xl border p-4 ${
                      isAccepted
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{q.business_name}</p>
                        <Rating avg={q.avg_rating} count={q.rating_count} />
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatMoney(q.amount_pence)}
                        </p>
                        {job.status !== "open" && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${qs.className}`}
                          >
                            {qs.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {q.message && (
                      <p className="mt-2 text-sm text-muted">{q.message}</p>
                    )}
                    {job.status === "open" && q.status === "pending" && (
                      <form action={acceptQuote} className="mt-3">
                        <input type="hidden" name="quote_id" value={q.quote_id} />
                        <input type="hidden" name="job_id" value={job.id} />
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                        >
                          Accept this quote
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {(job.status === "awaiting_review" || job.status === "completed") && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold">
            {job.status === "awaiting_review"
              ? "Your cleaner has finished"
              : "Completed work"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {job.status === "awaiting_review"
              ? "Please review the after-photos and confirm the job is done."
              : "This job is complete."}
          </p>

          {photos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={p.url}
                    alt="After photo"
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No photos available.</p>
          )}

          {job.status === "awaiting_review" && (
            <>
              <form action={confirmCompletion} className="mt-5">
                <input type="hidden" name="job_id" value={job.id} />
                <button
                  type="submit"
                  className="rounded-xl bg-brand px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Confirm the job is done
                </button>
              </form>
              <p className="mt-3 text-xs text-muted">
                Something not right?{" "}
                <Link
                  href={`/customer/jobs/${job.id}/dispute`}
                  className="underline hover:text-foreground"
                >
                  Report a problem
                </Link>{" "}
                instead.
              </p>
            </>
          )}
        </section>
      )}

      {job.status === "disputed" && (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-amber-800">Problem reported</h2>
          <p className="mt-1 text-sm text-amber-800">
            Thanks — you&apos;ve reported a problem with this job. Our team will
            review it and be in touch. Your payment stays on hold in the meantime.
          </p>
        </section>
      )}
    </DashboardShell>
  );
}
