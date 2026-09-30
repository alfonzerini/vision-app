import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth";

const roleLabels: Record<SessionUser["role"], string> = {
  customer: "Customer",
  cleaner: "Cleaner",
  admin: "Admin",
};

/** Shared header + page frame for all signed-in dashboards. */
export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Vision"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg"
            />
            <span className="text-lg font-bold">Vision</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {user.full_name ?? user.email}
            </span>
            <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
              {roleLabels[user.role]}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-brand-light"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}

/** A simple placeholder card for features still being built. */
export function FeatureCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

/** A tappable card that links somewhere — for live features. */
export function FeatureLink({
  href,
  title,
  body,
  primary,
}: {
  href: string;
  title: string;
  body: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 shadow-sm transition-colors ${
        primary
          ? "border-brand bg-brand-light hover:bg-brand-light/70"
          : "border-border bg-card hover:border-brand"
      }`}
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </Link>
  );
}
