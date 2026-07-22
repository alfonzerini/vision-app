import Image from "next/image";
import Link from "next/link";

/** Centered, branded shell for the login/signup screens. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-brand-light to-background px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Vision"
            width={72}
            height={72}
            priority
            className="h-16 w-16 rounded-2xl shadow-md"
          />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
