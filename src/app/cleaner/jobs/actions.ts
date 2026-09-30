"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export interface QuoteState {
  error?: string;
  success?: boolean;
}

const schema = z.object({
  job_id: z.string().uuid(),
  amount_pounds: z.coerce
    .number({ message: "Enter a price." })
    .positive("Enter a price greater than £0.")
    .max(100000, "That price looks too high."),
  message: z.string().trim().max(1000).optional(),
});

export async function submitQuote(
  _prev: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  await requireRole("cleaner");

  const parsed = schema.safeParse({
    job_id: formData.get("job_id"),
    amount_pounds: formData.get("amount_pounds"),
    message: formData.get("message") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const { job_id, amount_pounds, message } = parsed.data;
  const amount_pence = Math.round(amount_pounds * 100);

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_quote", {
    p_job_id: job_id,
    p_amount_pence: amount_pence,
    p_message: message || null,
  });

  if (error) {
    return { error: error.message || "Couldn't send your quote. Please try again." };
  }

  revalidatePath(`/cleaner/jobs/${job_id}`);
  revalidatePath("/cleaner/jobs");
  return { success: true };
}
