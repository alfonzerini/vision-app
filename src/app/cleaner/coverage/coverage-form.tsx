"use client";

import { useActionState } from "react";
import { updateCoverage, type CoverageState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/form";

export interface CoverageDefaults {
  business_name: string;
  description: string;
  base_postcode: string;
  coverage_radius_miles: number;
}

const RADIUS_OPTIONS = [2, 3, 5, 10, 15, 20, 30];

export function CoverageForm({ defaults }: { defaults: CoverageDefaults }) {
  const [state, formAction] = useActionState<CoverageState, FormData>(
    updateCoverage,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <Field label="Business name" htmlFor="business_name">
        <TextInput
          id="business_name"
          name="business_name"
          defaultValue={defaults.business_name}
          required
          placeholder="e.g. Crystal Clear Windows"
        />
      </Field>

      <Field
        label="About your business (optional)"
        htmlFor="description"
        hint="A short intro customers will see with your quotes."
      >
        <TextArea
          id="description"
          name="description"
          defaultValue={defaults.description}
          placeholder="Friendly, insured, 10 years' experience…"
        />
      </Field>

      <Field
        label="Base postcode"
        htmlFor="base_postcode"
        hint="Where you're based — we use this to find nearby jobs."
      >
        <TextInput
          id="base_postcode"
          name="base_postcode"
          defaultValue={defaults.base_postcode}
          required
          placeholder="LS1 4AB"
        />
      </Field>

      <Field
        label="How far will you travel?"
        htmlFor="coverage_radius_miles"
      >
        <Select
          id="coverage_radius_miles"
          name="coverage_radius_miles"
          defaultValue={String(defaults.coverage_radius_miles)}
        >
          {RADIUS_OPTIONS.map((mi) => (
            <option key={mi} value={mi}>
              Within {mi} miles
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton>Save &amp; find jobs</SubmitButton>
    </form>
  );
}
