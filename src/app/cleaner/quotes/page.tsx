import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  CLEAN_TYPE_LABEL,
  JOB_STATUS,
  QUOTE_STATUS,
  formatDate,
  formatMoney,
} from "@/lib/display";
import type { CleanType, JobStatus, QuoteStatus } from "@/lib/types";

export const metadata: Metadata = { title: "My quotes" };

interface QuoteRow {
  id: string;
  amount_pence: number;
  status: QuoteStatus;
  created_at: string;
  job: {
    id: string;
    clean_type: CleanType;
    window_count: number | null;
    status: JobStatus;
  } | null;
}

export default async function MyQuotesPage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  const { data } = await supabase
    .from("quotes")
    .select(
      "id, amount_pence, status, created_at, job:jobs!quotes_job_id_fkey(id, clean_type, window_count, status)",
    )
    .order("created_at", { ascending: false });

  const quotes = (data as unknown as QuoteRow[]) ?? [];

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">My quotes</h1>

      {quotes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted">You haven&apos;t sent any quotes yet.</p>
          <Link
            href="/cleaner/jobs"
            className="mt-3 inline-block font-semibold text-brand underline"
          >
            Find jobs near you
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {quotes.map((q) => {
            // For the winning (accepted) quote, show the job's progress
            // (Booked → Awaiting confirmation → Completed ✅); otherwise show
            // the quote's own status (pending / not chosen).
            const s =
              q.status === "accepted" && q.job
                ? JOB_STATUS[q.job.status]
                : QUOTE_STATUS[q.status];
            return (
              <li key={q.id}>
                <Link
                  href={q.job ? `/cleaner/jobs/${q.job.id}` : "/cleaner/jobs"}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand"
                >
                  <div>
                    <p className="font-semibold">
                      {q.job ? CLEAN_TYPE_LABEL[q.job.clean_type] : "Job"}
                      {q.job?.window_count ? ` · ${q.job.window_count} windows` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {q.status === "accepted" ? "Agreed" : "Quoted"}{" "}
                      {formatMoney(q.amount_pence)} · {formatDate(q.created_at)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.className}`}>
                    {s.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
