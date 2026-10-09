"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, roleHome } from "@/lib/auth";

export interface ReviewState {
  error?: string;
  success?: boolean;
}

const schema = z.object({
  job_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "Please choose a star rating.").max(5),
  body: z.string().trim().max(1000).optional(),
});

/** Submit a review of the other party on a completed job. */
export async function submitReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    job_id: formData.get("job_id"),
    rating: formData.get("rating"),
    body: formData.get("body") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_job_id: parsed.data.job_id,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body ?? null,
  });
  if (error) {
    return { error: error.message || "Couldn't save your review. Please try again." };
  }

  revalidatePath(`${roleHome(user.role)}/jobs/${parsed.data.job_id}`);
  return { success: true };
}
