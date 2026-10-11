import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { deleteProperty } from "./actions";

export const metadata: Metadata = { title: "My properties" };

interface PropertyRow {
  id: string;
  label: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postcode: string;
  access_notes: string | null;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const user = await requireRole("customer");
  const { saved, deleted, error } = await searchParams;
  const supabase = await createClient();

  const { data: propRows } = await supabase
    .from("properties")
    .select("id, label, address_line1, address_line2, city, postcode, access_notes")
    .order("created_at", { ascending: false });
  const properties = (propRows as PropertyRow[] | null) ?? [];

  // Count jobs per property so we only offer delete on addresses with none
  // (the database blocks deleting an address that still has jobs).
  const { data: jobRows } = await supabase.from("jobs").select("property_id");
  const jobCounts = new Map<string, number>();
  for (const j of (jobRows as { property_id: string }[] | null) ?? []) {
    jobCounts.set(j.property_id, (jobCounts.get(j.property_id) ?? 0) + 1);
  }

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My properties</h1>
          <p className="mt-1 text-muted">
            Save your addresses once, then pick one when you post a job.
          </p>
        </div>
        <Link
          href="/customer/properties/new"
          className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          + Add address
        </Link>
      </div>

      {saved && <Banner tone="success">Address saved.</Banner>}
      {deleted && <Banner tone="success">Address deleted.</Banner>}
      {error === "in-use" && (
        <Banner tone="warning">
          That address is used by one or more jobs, so it can&apos;t be deleted.
        </Banner>
      )}

      {properties.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted">You haven&apos;t saved any addresses yet.</p>
          <Link
            href="/customer/properties/new"
            className="mt-3 inline-block font-semibold text-brand underline"
          >
            Add your first address
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {properties.map((p) => {
            const count = jobCounts.get(p.id) ?? 0;
            return (
              <li
                key={p.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl text-amber-700"
                    aria-hidden
                  >
                    🏠
                  </span>
                  <div className="min-w-0">
                    {p.label && <p className="font-semibold">{p.label}</p>}
                    <p className={p.label ? "text-sm text-muted" : "font-semibold"}>
                      {p.address_line1}
                      {p.address_line2 ? `, ${p.address_line2}` : ""}
                    </p>
                    <p className="text-sm text-muted">
                      {p.city ? `${p.city}, ` : ""}
                      {p.postcode}
                    </p>
                  </div>
                </div>

                {p.access_notes && (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-muted">
                    <span className="font-medium">Access:</span> {p.access_notes}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-sm">
                  <Link
                    href={`/customer/properties/${p.id}/edit`}
                    className="font-semibold text-brand hover:underline"
                  >
                    Edit
                  </Link>
                  {count > 0 ? (
                    <span className="ml-auto text-xs text-muted">
                      {count} {count === 1 ? "job" : "jobs"}
                    </span>
                  ) : (
                    <form action={deleteProperty} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="font-medium text-muted transition-colors hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-800";
  return (
    <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${cls}`}>
      {children}
    </p>
  );
}
