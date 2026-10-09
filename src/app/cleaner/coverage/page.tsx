import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaymentNotice } from "@/components/payment-notice";
import { AvatarUpload } from "@/components/avatar-upload";
import { DocumentsSection, type DocumentRow } from "@/components/documents-section";
import { Stars } from "@/components/stars";
import { metresToMiles } from "@/lib/display";
import { CoverageForm, type CoverageDefaults } from "./coverage-form";

export const metadata: Metadata = { title: "My coverage" };

export default async function CoveragePage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  const { data } = await supabase
    .from("cleaner_profiles")
    .select(
      "business_name, description, base_postcode, coverage_radius_m, avg_rating, rating_count, completed_jobs",
    )
    .eq("profile_id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("rating, body")
    .eq("reviewee_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: docRows } = await supabase
    .from("documents")
    .select("id, type, status, expiry_date, file_path")
    .eq("cleaner_id", user.id)
    .order("created_at", { ascending: false });

  const avgRating = Number(data?.avg_rating ?? 0);
  const ratingCount = data?.rating_count ?? 0;
  const completedJobs = data?.completed_jobs ?? 0;
  const reviews = (reviewRows as { rating: number; body: string | null }[] | null) ?? [];
  const documents = (docRows as unknown as DocumentRow[]) ?? [];

  const defaults: CoverageDefaults = {
    business_name: data?.business_name ?? "",
    description: data?.description ?? "",
    base_postcode: data?.base_postcode ?? "",
    coverage_radius_miles: data?.coverage_radius_m
      ? Math.round(metresToMiles(data.coverage_radius_m))
      : 5,
  };

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Your profile &amp; coverage</h1>
      <p className="mt-1 text-muted">
        Tell us about your business and where you work, so we can show you the
        right jobs.
      </p>

      <div className="mt-6 max-w-xl rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Your rating</p>
          <span className="text-xs text-muted">Set by customers · read-only</span>
        </div>
        {ratingCount > 0 ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <Stars rating={avgRating} className="text-2xl" />
              <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted">
                ({ratingCount} review{ratingCount > 1 ? "s" : ""})
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {completedJobs} job{completedJobs === 1 ? "" : "s"} completed.
              Customers see this on your quotes.
            </p>
            {reviews.length > 0 && (
              <ul className="mt-4 space-y-3">
                {reviews.map((r, i) => (
                  <li
                    key={i}
                    className="border-t border-border pt-3 first:border-0 first:pt-0"
                  >
                    <Stars rating={r.rating} />
                    {r.body && (
                      <p className="mt-1 text-sm text-muted">
                        &ldquo;{r.body}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No reviews yet. As you complete jobs, customers can rate you — your
            average will show here and on your quotes.
          </p>
        )}
      </div>

      <div className="mt-6 max-w-xl rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold">Profile photo</p>
        <AvatarUpload
          userId={user.id}
          initialUrl={
            (profile as { avatar_url: string | null } | null)?.avatar_url ?? null
          }
          name={user.full_name}
        />
      </div>

      <div className="mt-6 max-w-xl rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold">Verification documents</p>
        <DocumentsSection cleanerId={user.id} initialDocs={documents} />
      </div>

      <div className="mt-6 max-w-xl">
        <PaymentNotice role="cleaner" />
      </div>

      <div className="mt-6 max-w-xl">
        <CoverageForm defaults={defaults} />
      </div>
    </DashboardShell>
  );
}
