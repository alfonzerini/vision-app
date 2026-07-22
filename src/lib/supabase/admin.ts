import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

/**
 * Privileged Supabase client that BYPASSES Row-Level Security.
 *
 * Use ONLY in trusted server-side code (webhooks, scheduled tasks, admin
 * actions) for operations end users must never perform directly — e.g. moving
 * money, releasing escrow, writing audit logs. The `server-only` import above
 * makes the build fail if this file is ever pulled into a client bundle.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — admin client unavailable.",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
