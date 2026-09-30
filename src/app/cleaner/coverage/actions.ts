"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { geocodePostcode } from "@/lib/geocode";
import { milesToMetres } from "@/lib/display";

export interface CoverageState {
  error?: string;
}

const schema = z.object({
  business_name: z.string().trim().min(2, "Please enter your business name."),
  description: z.string().trim().optional(),
  base_postcode: z.string().trim().min(5, "Please enter your base postcode."),
  coverage_radius_miles: z.coerce.number().min(1).max(50),
});

export async function updateCoverage(
  _prev: CoverageState,
  formData: FormData,
): Promise<CoverageState> {
  const user = await requireRole("cleaner");

  const parsed = schema.safeParse({
    business_name: formData.get("business_name"),
    description: formData.get("description") ?? undefined,
    base_postcode: formData.get("base_postcode"),
    coverage_radius_miles: formData.get("coverage_radius_miles"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;

  // Geocode the base postcode — required, so "near me" search works.
  const geo = await geocodePostcode(d.base_postcode);
  if (!geo) {
    return {
      error: "We couldn't find that postcode. Please check it and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaner_profiles")
    .update({
      business_name: d.business_name,
      description: d.description || null,
      base_postcode: d.base_postcode.toUpperCase(),
      base_latitude: geo.latitude,
      base_longitude: geo.longitude,
      coverage_radius_m: milesToMetres(d.coverage_radius_miles),
    })
    .eq("profile_id", user.id);

  if (error) {
    return { error: "Couldn't save your coverage. Please try again." };
  }

  redirect("/cleaner/jobs");
}
