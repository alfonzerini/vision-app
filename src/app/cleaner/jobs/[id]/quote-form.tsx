"use client";

import { useActionState } from "react";
import { submitQuote, type QuoteState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, TextArea, TextInput } from "@/components/form";

export function QuoteForm({
  jobId,
  existingAmountPence,
}: {
  jobId: string;
  existingAmountPence: number | null;
}) {
  const [state, formAction] = useActionState<QuoteState, FormData>(
    submitQuote,
    {},
  );
  const hasExisting = existingAmountPence != null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="job_id" value={jobId} />
      <FormError message={state.error} />
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Quote sent — the customer has been notified.
        </p>
      )}

      <Field label="Your price (£)" htmlFor="amount_pounds">
        <TextInput
          id="amount_pounds"
          name="amount_pounds"
          type="number"
          min="1"
          step="0.01"
          inputMode="decimal"
          required
          defaultValue={
            existingAmountPence != null
              ? (existingAmountPence / 100).toFixed(2)
              : ""
          }
          placeholder="e.g. 25.00"
        />
      </Field>

      <Field
        label="Message (optional)"
        htmlFor="message"
        hint="Introduce yourself or ask a question."
      >
        <TextArea
          id="message"
          name="message"
          placeholder="Hi! I can do this on Thursday morning…"
        />
      </Field>

      <SubmitButton>{hasExisting ? "Update quote" : "Send quote"}</SubmitButton>
    </form>
  );
}
