import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/config";

const steps = [
  {
    n: 1,
    title: "Post your job",
    body: "Add your address, tell us what needs cleaning, and snap a couple of photos. Takes two minutes.",
  },
  {
    n: 2,
    title: "Compare quotes",
    body: "Trusted local cleaners send you prices. Compare ratings, reviews and response times — then pick one.",
  },
  {
    n: 3,
    title: "Relax — it's done",
    body: "Pay securely in the app. Your money is held safely and only released once the work is finished.",
  },
];

const trust = [
  {
    title: "Secure escrow payments",
    body: "Your payment is held safely and only released when the job is done.",
  },
  {
    title: "Verified, insured cleaners",
    body: "We check insurance and ID so you can book with confidence.",
  },
  {
    title: "Real ratings & reviews",
    body: "Every job is reviewed by both sides, so quality stays high.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="bg-gradient-to-b from-brand-light to-background">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-16 text-center sm:py-24">
          <Image
            src="/logo.png"
            alt="Vision logo"
            width={112}
            height={112}
            priority
            className="h-24 w-24 rounded-2xl shadow-lg sm:h-28 sm:w-28"
          />
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              {BRAND.tagline}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted sm:text-xl">
              {BRAND.description}
            </p>
          </div>

          {/* Two clear entry points */}
          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=customer"
              className="flex-1 rounded-xl bg-brand px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Get my windows cleaned
            </Link>
            <Link
              href="/signup?role=cleaner"
              className="flex-1 rounded-xl border-2 border-brand bg-background px-6 py-4 text-lg font-semibold text-brand transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              I&apos;m a window cleaner
            </Link>
          </div>
          <p className="text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand underline">
              Log in
            </Link>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- How it works */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">How Vision works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg font-bold text-slate-900">
                {s.n}
              </div>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Trust row */}
      <section className="bg-brand-light">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-16 sm:grid-cols-3">
          {trust.map((t) => (
            <div key={t.title}>
              <h3 className="text-lg font-semibold text-brand-dark">
                {t.title}
              </h3>
              <p className="mt-2 text-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-center text-sm text-muted">
        <p>
          © {new Date().getFullYear()} {BRAND.name}. Made in the UK.
        </p>
      </footer>
    </main>
  );
}
