import Link from "next/link";

/** A colourful, tappable action card with an icon badge. */
export function ActionTile({
  href,
  emoji,
  title,
  body,
  tint = "bg-brand-light text-brand-dark",
  soon = false,
}: {
  href?: string;
  emoji: string;
  title: string;
  body: string;
  tint?: string;
  soon?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${tint}`}
        aria-hidden
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          {title}
          {soon && (
            <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Soon
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">{body}</p>
      </div>
      {!soon && (
        <span className="ml-auto text-lg text-muted transition-transform group-hover:translate-x-0.5">
          ›
        </span>
      )}
    </>
  );

  if (soon || !href) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-4 opacity-70">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
    >
      {inner}
    </Link>
  );
}

/** Small translucent stat pill for use inside the gradient hero. */
export function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
      {children}
    </span>
  );
}
