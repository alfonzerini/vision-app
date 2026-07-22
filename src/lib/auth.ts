import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/config";
import type { UserRole } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
  role: UserRole;
  full_name: string | null;
  is_suspended: boolean;
}

/** The signed-in user + their profile/role, or null if signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, is_suspended")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as UserRole) ?? "customer",
    full_name: profile?.full_name ?? null,
    is_suspended: profile?.is_suspended ?? false,
  };
}

/** The dashboard home path for a given role. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case "admin":
      return ROUTES.adminDashboard;
    case "cleaner":
      return ROUTES.cleanerDashboard;
    default:
      return ROUTES.customerDashboard;
  }
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.login);
  return user;
}

/**
 * Require a specific role. Admins are allowed everywhere. Anyone signed in with
 * the wrong role is bounced to their own dashboard; signed-out users to /login.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "admin") {
    redirect(roleHome(user.role));
  }
  return user;
}
