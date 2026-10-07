"use client";

import { useActionState } from "react";
import { raiseDispute, type DisputeState } from "../../actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Select, TextArea } from "@/components/form";

const REASONS: { value: string; label: string }[] = [
  { value: "poor_quality", label: "Poor quality work" },
  { value: "incomplete", label: "The work was incomplete" },
  { value: "no_show", label: "The cleaner didn't attend" },
  { value: "property_damage", label: "Property was damaged" },
];

export function DisputeForm({ jobId }: { jobId: string }) {
  const [state, formAction] = useActionState<DisputeState, FormData>(
    raiseDispute,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="job_id" value={jobId} />
      <FormError message={state.error} />

      <Field label="What was the problem?" htmlFor="reason">
        <Select id="reason" name="reason" defaultValue="poor_quality">
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Tell us what happened"
        htmlFor="description"
        hint="The more detail you give, the quicker we can help."
      >
        <TextArea
          id="description"
          name="description"
          required
          minLength={10}
          placeholder="Describe the problem…"
        />
      </Field>

      <SubmitButton>Report the problem</SubmitButton>
    </form>
  );
}
