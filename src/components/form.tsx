/**
 * Small, consistent, accessible form primitives used across Vision's forms.
 * Large tap targets and clear labels — friendly on mobile and for all ages.
 */
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const controlClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand";

/** Label + optional hint wrapper around a single control. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={controlClass} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} min-h-24`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass} />;
}

/** A large, tappable checkbox card — used for the job "extras" tick-boxes. */
export function CheckboxCard({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-light">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-5 w-5 accent-brand"
      />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Inline error banner for form actions. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      {message}
    </p>
  );
}
