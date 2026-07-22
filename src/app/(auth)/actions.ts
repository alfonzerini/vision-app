"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth";
import { ROUTES } from "@/lib/config";

export interface AuthState {
  error?: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------- validation
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

// Note: role is deliberately limited to customer/cleaner. Admins are created
// manually — never through public signup (also enforced by the DB trigger).
const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
  role: z.enum(["customer", "cleaner"]),
});

// ---------------------------------------------------------------------- login
export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "That email or password isn't right. Please try again." };
  }

  // Send the user to the dashboard that matches their role.
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .single();
  redirect(roleHome((data?.role as "customer" | "cleaner" | "admin") ?? "customer"));
}

// --------------------------------------------------------------------- signup
export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const { full_name, email, password, role } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Passed into the handle_new_user DB trigger to create the profile.
      data: { full_name, role },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is on, there's no session yet — ask them to confirm.
  if (!data.session) {
    redirect(`${ROUTES.login}?message=check-email`);
  }

  redirect(roleHome(role));
}

// --------------------------------------------------------------------- logout
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ROUTES.home);
}
