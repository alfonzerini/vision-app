import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const messages: Record<string, string> = {
  "check-email": "Almost there! Check your email and click the link to confirm your account, then log in.",
  "auth-error": "That confirmation link didn't work. Please try logging in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const notice = message ? messages[message] : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted">Log in to your Vision account.</p>
      </div>

      {notice && (
        <p className="rounded-lg bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">
          {notice}
        </p>
      )}

      <LoginForm />

      <p className="text-center text-sm text-muted">
        New to Vision?{" "}
        <Link href="/signup" className="font-semibold text-brand underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
