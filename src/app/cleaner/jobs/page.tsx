import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  CLEAN_TYPE_LABEL,
  formatDate,
  formatDistance,
  metresToMiles,
} from "@/lib/display";
import type { CleanType } from "@/lib/types";

export const metadata: Metadata = { title: "Jobs near me" };

interface NearbyJob {
  id: string;
  clean_type: CleanType;
  window_count: number | null;
  has_conservatory: boolean;
  has_skylights: boolean;
  has_solar_panels: boolean;
  has_veranda: boolean;
  preferred_date: string | null;
  created_at: string;
  city: string | null;
  postcode_area: string | null;
  distance_m: number | null;
  has_quoted: boolean;
}

export default async function CleanerJobsPage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  // Has the cleaner set up their coverage area yet?
  const { data: profile } = await supabase
    .from("cleaner_profiles")
    .select("base_latitude, base_postcode, coverage_radius_m")
    .eq("profile_id", user.id)
    .single();

  const coverageSet = profile?.base_latitude != null;

  if (!coverageSet) {
    return (
      <DashboardShell user={user}>
        <h1 className="text-2xl font-bold">Jobs near me</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted">
            First, tell us where you&apos;re based and how far you&apos;ll
            travel — then we&apos;ll show you nearby jobs.
          </p>
          <Link
            href="/cleaner/coverage"
            className="mt-4 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            Set up my coverage
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { data } = await supabase.rpc("jobs_near_me");
  const jobs = (data as NearbyJob[] | null) ?? [];
  const radiusMiles = profile?.coverage_radius_m
    ? Math.round(metresToMiles(profile.coverage_radius_m))
    : 5;

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs near me</h1>
        <Link
          href="/cleaner/coverage"
          className="text-sm font-medium text-brand hover:underline"
        >
          {profile?.base_postcode} · within {radiusMiles} mi · edit
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          No open jobs in your area right now. Check back soon — we&apos;ll keep
          looking.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => {
            const extras = [
              job.has_conservatory && "Conservatory",
              job.has_skylights && "Skylights",
              job.has_solar_panels && "Solar panels",
              job.has_veranda && "Veranda",
            ].filter(Boolean) as string[];
            return (
              <li key={job.id}>
                <Link
                  href={`/cleaner/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand"
                >
                  <div>
                    <p className="font-semibold">
                      {CLEAN_TYPE_LABEL[job.clean_type]}
                      {job.window_count ? ` · ${job.window_count} windows` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {job.city ?? job.postcode_area ?? "Nearby"}
                      {extras.length ? ` · ${extras.join(", ")}` : ""}
                      {" · posted "}
                      {formatDate(job.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
                      {formatDistance(job.distance_m)}
                    </span>
                    {job.has_quoted && (
                      <span className="text-xs font-medium text-emerald-600">
                        Quote sent
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
