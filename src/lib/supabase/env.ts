/**
 * Central place for reading Supabase connection settings from the environment.
 *
 * We intentionally do NOT throw at import time when these are missing, so the
 * public site (e.g. the landing page) still renders before the database is
 * connected. Code that actually needs Supabase checks `supabaseConfigured`.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the public Supabase URL + anon key are present. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Server-only service-role key. Never import this into client components. */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
