import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PropertyForm, type PropertyValues } from "../../property-form";

export const metadata: Metadata = { title: "Edit address" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("customer");
  const { id } = await params;
  const supabase = await createClient();

  // RLS limits this to the customer's own properties.
  const { data } = await supabase
    .from("properties")
    .select("id, label, address_line1, address_line2, city, postcode, access_notes")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const property = data as PropertyValues;

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Edit address</h1>
      <div className="mt-6 max-w-2xl">
        <PropertyForm property={property} />
      </div>
    </DashboardShell>
  );
}
