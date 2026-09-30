/** Presentation helpers shared across the UI. */
import type { CleanType, JobStatus } from "@/lib/types";

export const JOB_STATUS: Record<
  JobStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  open: { label: "Open for quotes", className: "bg-brand-light text-brand-dark" },
  assigned: { label: "Booked", className: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "In progress", className: "bg-amber-100 text-amber-700" },
  awaiting_review: { label: "Awaiting your review", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
};

export const CLEAN_TYPE_LABEL: Record<CleanType, string> = {
  inside: "Inside only",
  outside: "Outside only",
  both: "Inside & outside",
};

/** Pence → "£45.50". */
export function formatMoney(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(pence / 100);
}

/** ISO date/datetime → "26 Jul 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
