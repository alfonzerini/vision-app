"use client";

import { useActionState, useState } from "react";
import { createJob, type JobFormState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CheckboxCard,
  Field,
  FormError,
  Select,
  TextArea,
  TextInput,
} from "@/components/form";

export interface SavedProperty {
  id: string;
  label: string | null;
  address_line1: string;
  postcode: string;
}

export function NewJobForm({ properties }: { properties: SavedProperty[] }) {
  const [state, formAction] = useActionState<JobFormState, FormData>(
    createJob,
    {},
  );
  // "" means "a new address"; otherwise the chosen saved property id.
  const [propertyId, setPropertyId] = useState<string>(
    properties[0]?.id ?? "",
  );
  const addingNew = propertyId === "";

  return (
    <form action={formAction} className="space-y-8">
      <FormError message={state.error} />

      {/* ---------------------------------------------------------- Address */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Where is the job?</h2>

        {properties.length > 0 && (
          <Field label="Address" htmlFor="property_id">
            <Select
              id="property_id"
              name="property_id"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label ? `${p.label} — ` : ""}
                  {p.address_line1}, {p.postcode}
                </option>
              ))}
              <option value="">➕ Add a new address</option>
            </Select>
          </Field>
        )}

        {addingNew && (
          <div className="space-y-4 rounded-xl border border-border p-4">
            {properties.length === 0 && (
              <input type="hidden" name="property_id" value="" />
            )}
            <Field label="Address line 1" htmlFor="address_line1">
              <TextInput
                id="address_line1"
                name="address_line1"
                autoComplete="address-line1"
                required={addingNew}
                placeholder="12 Example Street"
              />
            </Field>
            <Field label="Address line 2 (optional)" htmlFor="address_line2">
              <TextInput
                id="address_line2"
                name="address_line2"
                autoComplete="address-line2"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Town / city" htmlFor="city">
                <TextInput id="city" name="city" autoComplete="address-level2" />
              </Field>
              <Field label="Postcode" htmlFor="postcode">
                <TextInput
                  id="postcode"
                  name="postcode"
                  autoComplete="postal-code"
                  required={addingNew}
                  placeholder="LS1 4AB"
                />
              </Field>
            </div>
            <Field
              label="Access notes (optional)"
              htmlFor="property_access_notes"
              hint="e.g. gate code, where to park, dog in garden."
            >
              <TextArea id="property_access_notes" name="property_access_notes" />
            </Field>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- Cleaning */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">What needs cleaning?</h2>
        <Field label="Windows" htmlFor="clean_type">
          <Select id="clean_type" name="clean_type" defaultValue="both">
            <option value="outside">Outside only</option>
            <option value="inside">Inside only</option>
            <option value="both">Inside &amp; outside</option>
          </Select>
        </Field>
        <Field
          label="Roughly how many windows? (optional)"
          htmlFor="window_count"
          hint="A rough number helps cleaners quote accurately."
        >
          <TextInput
            id="window_count"
            name="window_count"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="e.g. 12"
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Any of these? (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckboxCard name="has_conservatory" label="Conservatory" />
            <CheckboxCard name="has_skylights" label="Skylights" />
            <CheckboxCard name="has_solar_panels" label="Solar panels" />
            <CheckboxCard name="has_veranda" label="Veranda / porch" />
          </div>
        </fieldset>
      </section>

      {/* ----------------------------------------------------------- When */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">When suits you?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred date (optional)" htmlFor="preferred_date">
            <TextInput id="preferred_date" name="preferred_date" type="date" />
          </Field>
          <Field label="Preferred time" htmlFor="preferred_time">
            <Select
              id="preferred_time"
              name="preferred_time"
              defaultValue="anytime"
            >
              <option value="anytime">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </Select>
          </Field>
        </div>
        <Field
          label="Anything else? (optional)"
          htmlFor="additional_notes"
          hint="Extra details for the cleaner."
        >
          <TextArea id="additional_notes" name="additional_notes" />
        </Field>
      </section>

      <SubmitButton>Post job &amp; get quotes</SubmitButton>
    </form>
  );
}
