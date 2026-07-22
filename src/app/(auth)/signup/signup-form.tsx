"use client";

import { useActionState, useState } from "react";
import { signup, type AuthState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import type { UserRole } from "@/lib/types";

const roleOptions: { value: "customer" | "cleaner"; label: string; hint: string }[] = [
  { value: "customer", label: "I need cleaning", hint: "Post jobs & hire cleaners" },
  { value: "cleaner", label: "I'm a cleaner", hint: "Find work & get paid" },
];

export function SignupForm({ initialRole }: { initialRole: "customer" | "cleaner" }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signup, {});
  const [role, setRole] = useState<UserRole>(initialRole);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}

      {/* Role selector — the choice that keeps accounts strictly separated */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">I'm signing up to…</legend>
        <div className="grid grid-cols-2 gap-3">
          {roleOptions.map((opt) => {
            const active = role === opt.value;
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-colors ${
                  active
                    ? "border-brand bg-brand-light"
                    : "border-border hover:border-brand"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={active}
                  onChange={() => setRole(opt.value)}
                  className="sr-only"
                />
                <span className="block font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{opt.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="full_name" className="block text-sm font-semibold">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
      </div>

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
