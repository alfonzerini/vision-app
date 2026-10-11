"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { geocodePostcode } from "@/lib/geocode";

export interface PropertyFormState {
  error?: string;
}

const schema = z.object({
  label: z.string().trim().max(60).optional(),
  address_line1: z.string().trim().min(1, "Please enter the address."),
  address_line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postcode: z.string().trim().min(1, "Please enter a postcode."),
  access_notes: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    label: formData.get("label") || undefined,
    address_line1: formData.get("address_line1") ?? "",
    address_line2: formData.get("address_line2") || undefined,
    city: formData.get("city") || undefined,
    postcode: formData.get("postcode") ?? "",
    access_notes: formData.get("access_notes") || undefined,
  });
}

/** Add a new saved address for the signed-in customer. */
export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const user = await requireRole("customer");
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const supabase = await createClient();

  // Best-effort geocode so jobs at this address appear in cleaners' search.
  const geo = await geocodePostcode(d.postcode);
  const { error } = await supabase.from("properties").insert({
    customer_id: user.id,
    label: d.label || null,
    address_line1: d.address_line1,
    address_line2: d.address_line2 || null,
    city: d.city || null,
    postcode: d.postcode,
    access_notes: d.access_notes || null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
  });
  if (error) {
    return { error: "Couldn't save that address. Please try again." };
  }

  revalidatePath("/customer/properties");
  redirect("/customer/properties?saved=1");
}

/** Edit one of the customer's saved addresses. */
export async function updateProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  await requireRole("customer");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing address." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const supabase = await createClient();

  const geo = await geocodePostcode(d.postcode);
  // RLS limits this to the customer's own rows.
  const { error } = await supabase
    .from("properties")
    .update({
      label: d.label || null,
      address_line1: d.address_line1,
      address_line2: d.address_line2 || null,
      city: d.city || null,
      postcode: d.postcode,
      access_notes: d.access_notes || null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    })
    .eq("id", id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }

  revalidatePath("/customer/properties");
  redirect("/customer/properties?saved=1");
}

/** Delete a saved address. Blocked by the DB if any job still uses it. */
export async function deleteProperty(formData: FormData) {
  await requireRole("customer");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/customer/properties");

  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) {
    // Most likely the FK restrict: a job still references this address.
    redirect("/customer/properties?error=in-use");
  }

  revalidatePath("/customer/properties");
  redirect("/customer/properties?deleted=1");
}
