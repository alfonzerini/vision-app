"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { geocodePostcode } from "@/lib/geocode";

export interface JobFormState {
  error?: string;
}

// Checkboxes arrive as "on" when ticked, or are absent.
const asBool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const schema = z
  .object({
    property_id: z.string().uuid().optional().or(z.literal("")),
    // New-address fields (used when property_id is empty)
    address_line1: z.string().trim().optional(),
    address_line2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    postcode: z.string().trim().optional(),
    property_access_notes: z.string().trim().optional(),

    clean_type: z.enum(["inside", "outside", "both"]),
    window_count: z.coerce.number().int().min(0).max(1000).optional(),
    has_conservatory: z.boolean(),
    has_skylights: z.boolean(),
    has_solar_panels: z.boolean(),
    has_veranda: z.boolean(),
    preferred_date: z.string().trim().optional(),
    preferred_time: z.enum(["anytime", "morning", "afternoon", "evening"]),
    access_notes: z.string().trim().optional(),
    additional_notes: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      (d.property_id && d.property_id.length > 0) ||
      (d.address_line1 && d.postcode),
    { message: "Please choose a saved address or enter a new one (with postcode)." },
  );

export async function createJob(
  _prev: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const user = await requireRole("customer");

  const parsed = schema.safeParse({
    property_id: formData.get("property_id") ?? "",
    address_line1: formData.get("address_line1") ?? undefined,
    address_line2: formData.get("address_line2") ?? undefined,
    city: formData.get("city") ?? undefined,
    postcode: formData.get("postcode") ?? undefined,
    property_access_notes: formData.get("property_access_notes") ?? undefined,
    clean_type: formData.get("clean_type"),
    window_count: formData.get("window_count") || undefined,
    has_conservatory: asBool(formData.get("has_conservatory")),
    has_skylights: asBool(formData.get("has_skylights")),
    has_solar_panels: asBool(formData.get("has_solar_panels")),
    has_veranda: asBool(formData.get("has_veranda")),
    preferred_date: formData.get("preferred_date") || undefined,
    preferred_time: formData.get("preferred_time") ?? "anytime",
    access_notes: formData.get("access_notes") ?? undefined,
    additional_notes: formData.get("additional_notes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const supabase = await createClient();

  // 1. Resolve the property: use the chosen saved one, or create a new one.
  let propertyId = d.property_id || "";
  if (!propertyId) {
    // Best-effort geocode so the job can appear in cleaners' "near me" search.
    const geo = await geocodePostcode(d.postcode ?? "");
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .insert({
        customer_id: user.id,
        address_line1: d.address_line1,
        address_line2: d.address_line2 || null,
        city: d.city || null,
        postcode: d.postcode,
        access_notes: d.property_access_notes || null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
      })
      .select("id")
      .single();
    if (propErr || !prop) {
      return { error: "Couldn't save that address. Please try again." };
    }
    propertyId = prop.id;
  }

  // 2. Look up the active service (window cleaning for now).
  const { data: service } = await supabase
    .from("service_types")
    .select("id")
    .eq("slug", "window_cleaning")
    .single();
  if (!service) {
    return { error: "Service unavailable right now. Please try again shortly." };
  }

  // 3. Create the job, published straight to the marketplace (status 'open').
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      customer_id: user.id,
      property_id: propertyId,
      service_type_id: service.id,
      status: "open",
      clean_type: d.clean_type,
      window_count: d.window_count ?? null,
      has_conservatory: d.has_conservatory,
      has_skylights: d.has_skylights,
      has_solar_panels: d.has_solar_panels,
      has_veranda: d.has_veranda,
      preferred_date: d.preferred_date || null,
      preferred_time: d.preferred_time,
      access_notes: d.access_notes || null,
      additional_notes: d.additional_notes || null,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return { error: "Couldn't post your job. Please try again." };
  }

  revalidatePath("/customer/jobs");
  redirect(`/customer/jobs/${job.id}`);
}

/**
 * Customer accepts a cleaner's quote. Delegates to the accept_quote DB function
 * which atomically assigns the cleaner, rejects the other quotes and notifies.
 */
export async function acceptQuote(formData: FormData) {
  await requireRole("customer");
  const quoteId = String(formData.get("quote_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_quote", { p_quote_id: quoteId });

  if (error) {
    redirect(`/customer/jobs/${jobId}?error=accept`);
  }
  revalidatePath(`/customer/jobs/${jobId}`);
  redirect(`/customer/jobs/${jobId}?accepted=1`);
}
