"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/_actions/reviews";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, TextArea } from "@/components/form";

/** Interactive review form with a clickable star rating. */
export function ReviewForm({
  jobId,
  revieweeName,
}: {
  jobId: string;
  revieweeName: string;
}) {
  const [state, formAction] = useActionState<ReviewState, FormData>(
    submitReview,
    {},
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state.success) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Thanks for your review ⭐
      </p>
    );
  }

  const shown = hover || rating;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="rating" value={rating} />
      <FormError message={state.error} />

      <div>
        <p className="text-sm font-semibold">
          How was your experience with {revieweeName}?
        </p>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className={`text-3xl leading-none transition-colors ${
                n <= shown ? "text-accent" : "text-border"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Field label="Add a comment (optional)" htmlFor="body">
        <TextArea id="body" name="body" placeholder="How did it go?" />
      </Field>

      <SubmitButton>Submit review</SubmitButton>
    </form>
  );
}
