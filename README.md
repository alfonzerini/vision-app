# Vision 🪟

**Spotless windows, sorted.** Vision is a UK marketplace that connects
homeowners with trusted local window cleaners — post a job, compare quotes, and
pay securely while your money is held safely until the work is done.

> Long-term goal: the UK's largest marketplace for exterior property cleaning
> (window cleaning first, then gutters, pressure washing, roofs, solar panels and
> more).

---

## For Alfie (non-technical quick start)

The app runs on your Mac. To see it:

```bash
cd ~/Developer/Vision
npm run dev
```

Then open **http://localhost:3000** in your browser. Press `Ctrl + C` in the
terminal to stop it.

> ⚠️ **Keep this project at `~/Developer/Vision`.** It was deliberately moved out
> of iCloud because iCloud breaks the build tools. Your Vision *documents* and
> logo still live in iCloud — only the code moved. Backup/sync happens through
> GitHub (set up separately).

To connect the database and logins, copy the environment template and fill in the
keys (we'll do this together):

```bash
cp .env.local.example .env.local
```

---

## Tech stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript)                |
| Styling    | Tailwind CSS v4                                     |
| Database   | Supabase (Postgres) with Row-Level Security        |
| Auth       | Supabase Auth (customer / cleaner / admin roles)   |
| Storage    | Supabase Storage (photos, documents)               |
| Payments   | Stripe Connect (escrow) — *coming in a later step* |
| Validation | Zod                                                |

## Project structure

```
src/
  app/            # pages (App Router)
  lib/
    config.ts     # branding + route paths + fallback setting defaults
    types.ts      # shared domain types (mirror the DB enums)
    supabase/     # database/auth clients (browser, server, admin) + middleware
  middleware.ts   # refreshes login sessions, protects private routes
supabase/
  migrations/     # versioned SQL: schema, security policies, seed data
```

## Key principles

- **Money is stored in pence** (never decimals) to avoid rounding errors.
- **Security lives in the database.** Row-Level Security means the database
  itself enforces that customers, cleaners and admins only see what they should.
- **Business rules are configurable** (commission %, review window, etc.) via the
  `platform_settings` table — nothing important is hard-coded.
- **Adding a new service** (e.g. gutter cleaning) is a single database row, not a
  rebuild.

See [`AGENTS.md`](./AGENTS.md) for the full engineering guide.
