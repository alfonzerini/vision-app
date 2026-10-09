/** Read-only star display (rating 0–5). Pure — safe in server components. */
export function Stars({
  rating,
  className = "",
}: {
  rating: number;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <span
      className={`text-accent ${className}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {"★★★★★".slice(0, rounded)}
      <span className="text-border">{"★★★★★".slice(rounded)}</span>
    </span>
  );
}
