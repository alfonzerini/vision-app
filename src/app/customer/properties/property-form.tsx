"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, TextArea, TextInput } from "@/components/form";
import {
  createProperty,
  updateProperty,
  type PropertyFormState,
} from "./actions";

export interface PropertyValues {
  id?: string;
  label: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postcode: string;
  access_notes: string | null;
}

/** Add/edit form for a saved address. Pass `property` to edit, omit to create. */
export function PropertyForm({ property }: { property?: PropertyValues }) {
  const editing = Boolean(property?.id);
  const [state, formAction] = useActionState<PropertyFormState, FormData>(
    editing ? updateProperty : createProperty,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      {editing && <input type="hidden" name="id" value={property!.id} />}

      <Field
        label="Name (optional)"
        htmlFor="label"
        hint="So you can tell addresses apart, e.g. “Home” or “Mum's house”."
      >
        <TextInput
          id="label"
          name="label"
          defaultValue={property?.label ?? ""}
          placeholder="Home"
        />
      </Field>

      <Field label="Address line 1" htmlFor="address_line1">
        <TextInput
          id="address_line1"
          name="address_line1"
          autoComplete="address-line1"
          required
          defaultValue={property?.address_line1 ?? ""}
          placeholder="12 Example Street"
        />
      </Field>

      <Field label="Address line 2 (optional)" htmlFor="address_line2">
        <TextInput
          id="address_line2"
          name="address_line2"
          autoComplete="address-line2"
          defaultValue={property?.address_line2 ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Town / city" htmlFor="city">
          <TextInput
            id="city"
            name="city"
            autoComplete="address-level2"
            defaultValue={property?.city ?? ""}
          />
        </Field>
        <Field label="Postcode" htmlFor="postcode">
          <TextInput
            id="postcode"
            name="postcode"
            autoComplete="postal-code"
            required
            defaultValue={property?.postcode ?? ""}
            placeholder="LS1 4AB"
          />
        </Field>
      </div>

      <Field
        label="Access notes (optional)"
        htmlFor="access_notes"
        hint="e.g. gate code, where to park, dog in garden."
      >
        <TextArea
          id="access_notes"
          name="access_notes"
          defaultValue={property?.access_notes ?? ""}
        />
      </Field>

      <SubmitButton>{editing ? "Save changes" : "Save address"}</SubmitButton>
    </form>
  );
}
