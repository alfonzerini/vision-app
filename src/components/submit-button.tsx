"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that shows a pending state while the form action runs.
 * Full-width, large tap target — friendly for all ages and mobile.
 */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand px-6 py-3.5 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
