import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { DisputeForm } from "./dispute-form";

export const metadata: Metadata = { title: "Report a problem" };

export default async function DisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("customer");
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select("id, status, customer_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const job = data as { id: string; status: string; customer_id: string };

  // A problem can only be reported while the job is awaiting review.
  if (job.status !== "awaiting_review") {
    redirect(`/customer/jobs/${id}`);
  }

  return (
    <DashboardShell user={user}>
      <h1 className="text-2xl font-bold">Report a problem</h1>
      <p className="mt-1 text-muted">
        Sorry something&apos;s not right. Tell us what happened and we&apos;ll
        look into it. Your payment stays on hold while we do.
      </p>

      <div className="mt-8 max-w-xl">
        <DisputeForm jobId={job.id} />
      </div>
    </DashboardShell>
  );
}
