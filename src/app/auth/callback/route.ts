import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

/**
 * Handles the link Supabase emails a new user to confirm their address.
 * Exchanges the one-time code for a session, then sends them to the right
 * dashboard for their role.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.from("profiles").select("role").single();
      const dest = roleHome((data?.role as UserRole) ?? "customer");
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=auth-error`);
}
