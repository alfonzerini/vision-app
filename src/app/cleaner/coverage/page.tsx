import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { metresToMiles } from "@/lib/display";
import { CoverageForm, type CoverageDefaults } from "./coverage-form";

export const metadata: Metadata = { title: "My coverage" };

export default async function CoveragePage() {
  const user = await requireRole("cleaner");
  const supabase = await createClient();

  const { data } = await supabase
    .from("cleaner_profiles")
    .select("business_name, description, base_postcode, coverage_radius_m")
    .eq("profile_id", user.id)
    .single();

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

      <div className="mt-8 max-w-xl">
        <CoverageForm defaults={defaults} />
      </div>
    </DashboardShell>
  );
}
