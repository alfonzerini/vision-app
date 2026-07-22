<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vision — project guide

Vision is a UK marketplace connecting homeowners with local window cleaners
(future: gutters, pressure washing, roof, solar, etc.). Roles: **customer**,
**cleaner**, **admin**. The full product spec lives in the parent workspace's
`CLAUDE.md`; this file is the engineering guide.

## Stack
- **Next.js 16** (App Router, TypeScript) + **Tailwind v4** (tokens in `src/app/globals.css`).
- **Supabase**: Postgres, Auth, Storage, Realtime.
- **Stripe Connect** (escrow) — added in a later milestone.
- **Zod** for input validation.

## Golden rules
1. **Money is integer pence.** Never floats. Currency is GBP.
2. **Security is enforced in the database** via Row-Level Security (see
   `supabase/migrations/*_rls_policies.sql`). Never rely on the frontend alone.
   Customers, cleaners and admins are strictly separated by `profiles.role`.
3. **Business rules are configurable**, not hard-coded — they live in the
   `platform_settings` table (commission %, review window, GPS radius, etc.).
   Fallback defaults are in `src/lib/config.ts` (`SETTINGS_DEFAULTS`).
4. **Adding a service = a new row** in `service_types`, not new tables.
5. **The service-role key bypasses RLS.** Only use `createAdminClient()`
   (`src/lib/supabase/admin.ts`) in trusted server code (webhooks, cron, admin).
   Never import it into a client component.
6. **Mobile-first, accessible, simple enough for a 70-year-old.** High contrast,
   large tap targets, minimal steps.

## Supabase clients
- Browser (Client Components): `src/lib/supabase/client.ts` → `createClient()`.
- Server (RSC / Route Handlers / Server Actions): `src/lib/supabase/server.ts`.
- Privileged server-only: `src/lib/supabase/admin.ts`.
- Session refresh + route protection: `src/proxy.ts` → `src/lib/supabase/proxy.ts`
  (Next 16 "proxy" convention, formerly "middleware").

## Commands
- `npm run dev` — local dev server (http://localhost:3000).
- `npm run build` — production build (run before committing big changes).
- `npm run lint` — ESLint.

## Environment / location
- **The code lives at `~/Developer/Vision` — a normal local folder, NOT iCloud.**
  Do not move it into iCloud: it breaks `node_modules` and Turbopack. Backup/sync
  is via GitHub. Copy `.env.local.example` → `.env.local` and fill in keys.
- Node is at `/usr/local/bin/node`. If `node` isn't found, prefix commands with
  `export PATH="/usr/local/bin:$PATH"`.

## Database migrations
SQL migrations are in `supabase/migrations/`, applied in filename order. To apply
them to a linked Supabase project: `npx supabase db push` (once the CLI + project
are linked), or paste each file into the Supabase SQL editor in order.
