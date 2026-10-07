"use client";

import { usePathname, useRouter } from "next/navigation";

// The dashboard "home" pages for each role — no back button needed there.
const HOME_PATHS = new Set(["/customer", "/cleaner", "/admin"]);

/**
 * A consistent back button for the app header. Goes to the previous page;
 * if there's no history (e.g. the user opened a deep link directly), it falls
 * back to their dashboard home. Hidden on the dashboard home pages themselves.
 */
export function BackButton({ homeHref }: { homeHref: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (HOME_PATHS.has(pathname)) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(homeHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-brand-light hover:text-brand-dark"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
