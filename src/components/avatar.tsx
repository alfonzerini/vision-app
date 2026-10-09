import Image from "next/image";

/** Round avatar: shows the photo, or a coloured initial when there's none. */
export function Avatar({
  url,
  name,
  size = 40,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name ?? "Profile photo"}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-light font-semibold text-brand-dark"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
