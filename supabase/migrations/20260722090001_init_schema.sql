-- ============================================================================
-- Vision — Core database schema (migration 0001)
-- ============================================================================
-- UK window-cleaning marketplace. Designed to scale and to add more exterior
-- cleaning services later WITHOUT schema changes (see `service_types`).
--
-- Conventions:
--   * All money is stored as INTEGER PENCE (e.g. £45.50 -> 4550). Never floats.
--   * All primary keys are UUIDs.
--   * Every table has created_at; mutable tables also have updated_at (auto).
--   * Timestamps are timestamptz (UTC).
--   * Identity/roles anchor on `profiles`, which is 1:1 with Supabase auth.users.
--   * Row-Level Security (RLS) is enabled here and POLICIES live in migration 0002.
-- ============================================================================

-- Postgres extensions ---------------------------------------------------------
-- PostGIS powers radius ("cleaners near me") searches. On Supabase, extensions
-- live in the `extensions` schema, so we add it to the search_path — that way
-- the `geography` type and its GiST index operators resolve correctly.
-- gen_random_uuid() is built into Postgres 13+, so pgcrypto is not required.
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================
create type user_role as enum ('customer', 'cleaner', 'admin');

-- Whole lifecycle of a job. Mirrors the payment/escrow flow in the spec.
create type job_status as enum (
  'draft',            -- customer still editing, not visible to cleaners
  'open',             -- published, receiving quotes
  'assigned',         -- a quote was accepted & paid; funds held in escrow
  'in_progress',      -- cleaner has started / arrived
  'awaiting_review',  -- cleaner submitted completion evidence; 24h review window
  'completed',        -- payment released, job closed
  'disputed',         -- customer raised a dispute; funds stay held
  'cancelled'
);

create type clean_type as enum ('inside', 'outside', 'both');

create type quote_status as enum (
  'pending', 'accepted', 'rejected', 'withdrawn', 'expired'
);

create type payment_status as enum (
  'requires_payment',    -- created, awaiting customer card payment
  'held',                -- paid; funds held by platform (escrow)
  'released',            -- transferred to cleaner
  'refunded',
  'partially_refunded',
  'failed'
);

create type dispute_reason as enum (
  'no_show', 'poor_quality', 'incomplete', 'property_damage'
);

create type dispute_status as enum (
  'open', 'under_review', 'resolved_customer', 'resolved_cleaner', 'cancelled'
);

create type document_type as enum (
  'public_liability_insurance', 'id_verification', 'vehicle', 'other'
);

create type document_status as enum ('pending', 'approved', 'rejected');

create type evidence_kind as enum ('before', 'after');

create type notification_type as enum (
  'new_quote', 'quote_accepted', 'payment_successful', 'cleaner_assigned',
  'job_reminder', 'job_complete', 'review_reminder', 'payment_released',
  'dispute_raised', 'dispute_resolved', 'new_message'
);

-- ============================================================================
-- HELPER: auto-update updated_at on row change
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- IDENTITY & ROLES
-- ============================================================================

-- One row per authenticated user. `role` is the single source of truth that
-- keeps customers, cleaners and admins strictly separated.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         user_role not null default 'customer',
  full_name    text,
  email        text,
  phone        text,
  avatar_url   text,
  is_suspended boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Extra fields that only apply to cleaners (1:1 with a profile of role 'cleaner').
create table cleaner_profiles (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  business_name       text,
  description         text,
  base_postcode       text,
  base_location       geography(point, 4326),          -- for "near me" radius search
  coverage_radius_m   integer not null default 8047,    -- ~5 miles default
  working_hours       jsonb,                            -- e.g. {"mon":["09:00","17:00"]}
  vehicle_details     text,
  insurance_expiry    date,
  is_verified         boolean not null default false,   -- admin-approved to receive jobs
  avg_rating          numeric(3,2) not null default 0,  -- denormalised for fast sorting
  rating_count        integer not null default 0,
  completed_jobs      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index cleaner_profiles_location_idx on cleaner_profiles using gist (base_location);
create index cleaner_profiles_verified_idx on cleaner_profiles(is_verified);

create trigger cleaner_profiles_set_updated_at
  before update on cleaner_profiles
  for each row execute function set_updated_at();

-- When a new user signs up in Supabase Auth, create their profile automatically.
-- The signup flow passes role + full_name in user metadata.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role user_role;
begin
  -- Never allow self-service admin creation; anything not 'cleaner' becomes 'customer'.
  requested_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer');
  if requested_role = 'admin' then
    requested_role := 'customer';
  end if;

  insert into profiles (id, role, full_name, email)
  values (
    new.id,
    requested_role,
    new.raw_user_meta_data->>'full_name',
    new.email
  );

  if requested_role = 'cleaner' then
    insert into cleaner_profiles (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- SERVICES (extensibility: new services = new rows, not new tables)
-- ============================================================================
create table service_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,        -- 'window_cleaning', 'gutter_cleaning', ...
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Which services a cleaner offers.
create table cleaner_services (
  cleaner_id      uuid not null references cleaner_profiles(profile_id) on delete cascade,
  service_type_id uuid not null references service_types(id) on delete cascade,
  primary key (cleaner_id, service_type_id)
);

-- ============================================================================
-- PROPERTIES
-- ============================================================================
create table properties (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references profiles(id) on delete cascade,
  label         text,                              -- "Home", "Mum's house"
  address_line1 text not null,
  address_line2 text,
  city          text,
  postcode      text not null,
  location      geography(point, 4326),
  access_notes  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index properties_customer_idx on properties(customer_id);
create index properties_location_idx on properties using gist (location);

create trigger properties_set_updated_at
  before update on properties
  for each row execute function set_updated_at();

-- ============================================================================
-- JOBS
-- ============================================================================
create table jobs (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references profiles(id) on delete cascade,
  property_id        uuid not null references properties(id) on delete restrict,
  service_type_id    uuid not null references service_types(id) on delete restrict,
  status             job_status not null default 'draft',

  -- Scope (window-cleaning specific fields; other services may ignore these)
  clean_type         clean_type not null default 'both',
  window_count       integer,
  has_conservatory   boolean not null default false,
  has_skylights      boolean not null default false,
  has_solar_panels   boolean not null default false,
  has_veranda        boolean not null default false,
  access_notes       text,
  additional_notes   text,
  preferred_date     date,
  preferred_time     text,                          -- e.g. 'morning', 'afternoon', 'anytime'

  -- Assignment (filled when a quote is accepted & paid)
  assigned_cleaner_id uuid references profiles(id) on delete set null,
  accepted_quote_id   uuid,                         -- FK added after quotes table exists
  agreed_price_pence  integer,

  published_at       timestamptz,
  completed_at       timestamptz,                   -- when cleaner submitted evidence
  review_deadline_at timestamptz,                   -- auto-release fires after this
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint window_count_positive check (window_count is null or window_count >= 0),
  constraint agreed_price_positive check (agreed_price_pence is null or agreed_price_pence >= 0)
);
create index jobs_customer_idx on jobs(customer_id);
create index jobs_status_idx on jobs(status);
create index jobs_assigned_cleaner_idx on jobs(assigned_cleaner_id);
create index jobs_service_type_idx on jobs(service_type_id);
-- Fast lookup for the hourly auto-release task.
create index jobs_awaiting_review_idx on jobs(review_deadline_at)
  where status = 'awaiting_review';

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Photos uploaded to a job (customer's "before" photos live here too).
create table job_photos (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  file_path  text not null,                         -- path in Supabase Storage
  created_at timestamptz not null default now()
);
create index job_photos_job_idx on job_photos(job_id);

-- ============================================================================
-- QUOTES
-- ============================================================================
create table quotes (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  cleaner_id   uuid not null references profiles(id) on delete cascade,
  amount_pence integer not null,
  message      text,
  status       quote_status not null default 'pending',
  valid_until  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint quote_amount_positive check (amount_pence >= 0)
);
-- A cleaner can only have one live quote per job.
create unique index quotes_one_active_per_cleaner
  on quotes(job_id, cleaner_id)
  where status in ('pending', 'accepted');
create index quotes_job_idx on quotes(job_id);
create index quotes_cleaner_idx on quotes(cleaner_id);

create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function set_updated_at();

-- Now that quotes exists, wire the jobs.accepted_quote_id FK.
alter table jobs
  add constraint jobs_accepted_quote_fk
  foreign key (accepted_quote_id) references quotes(id) on delete set null;

-- ============================================================================
-- MESSAGING (customer <-> cleaner, scoped to a job)
-- ============================================================================
create table messages (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body         text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index messages_job_idx on messages(job_id);
create index messages_recipient_idx on messages(recipient_id);

-- ============================================================================
-- PAYMENTS & STRIPE (escrow model via Stripe Connect)
-- ============================================================================
create table stripe_accounts (
  profile_id               uuid primary key references profiles(id) on delete cascade,
  stripe_account_id        text unique,
  charges_enabled          boolean not null default false,
  payouts_enabled          boolean not null default false,
  details_submitted        boolean not null default false,
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger stripe_accounts_set_updated_at
  before update on stripe_accounts
  for each row execute function set_updated_at();

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  job_id                   uuid not null references jobs(id) on delete restrict,
  customer_id              uuid not null references profiles(id) on delete restrict,
  cleaner_id               uuid not null references profiles(id) on delete restrict,
  currency                 text not null default 'gbp',
  amount_pence             integer not null,          -- total customer pays
  commission_pence         integer not null,          -- platform fee
  cleaner_amount_pence     integer not null,          -- amount_pence - commission_pence
  status                   payment_status not null default 'requires_payment',
  stripe_payment_intent_id text unique,
  stripe_transfer_id       text,
  held_at                  timestamptz,
  released_at              timestamptz,
  refunded_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint payment_amounts_nonneg check (
    amount_pence >= 0 and commission_pence >= 0 and cleaner_amount_pence >= 0
  )
);
create index payments_job_idx on payments(job_id);
create index payments_cleaner_idx on payments(cleaner_id);
create index payments_status_idx on payments(status);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

-- ============================================================================
-- COMPLETION EVIDENCE (GPS + photos, gates job completion)
-- ============================================================================
create table completion_evidence (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  cleaner_id  uuid not null references profiles(id) on delete cascade,
  kind        evidence_kind not null default 'after',
  file_path   text not null,
  captured_lat double precision,
  captured_lng double precision,
  taken_at    timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index completion_evidence_job_idx on completion_evidence(job_id);

-- ============================================================================
-- REVIEWS (two-way: customer<->cleaner, one per reviewer per job)
-- ============================================================================
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating      smallint not null,
  body        text,
  created_at  timestamptz not null default now(),
  unique (job_id, reviewer_id),
  constraint rating_range check (rating between 1 and 5)
);
create index reviews_reviewee_idx on reviews(reviewee_id);

-- ============================================================================
-- DISPUTES (max one per job)
-- ============================================================================
create table disputes (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null unique references jobs(id) on delete cascade,
  raised_by        uuid not null references profiles(id) on delete cascade,
  reason           dispute_reason not null,
  description      text not null,
  status           dispute_status not null default 'open',
  resolution_notes text,
  resolved_by      uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  updated_at       timestamptz not null default now()
);
create index disputes_status_idx on disputes(status);

create trigger disputes_set_updated_at
  before update on disputes
  for each row execute function set_updated_at();

create table dispute_evidence (
  id         uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  file_path  text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- DOCUMENTS (cleaner verification: insurance, ID, etc.)
-- ============================================================================
create table documents (
  id          uuid primary key default gen_random_uuid(),
  cleaner_id  uuid not null references profiles(id) on delete cascade,
  type        document_type not null,
  file_path   text not null,
  status      document_status not null default 'pending',
  expiry_date date,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index documents_cleaner_idx on documents(cleaner_id);
create index documents_status_idx on documents(status);

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text,
  data       jsonb,                                 -- e.g. {"job_id": "..."}
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id) where read_at is null;

-- ============================================================================
-- PLATFORM SETTINGS (configurable — no hard-coded business values)
-- ============================================================================
create table platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger platform_settings_set_updated_at
  before update on platform_settings
  for each row execute function set_updated_at();

-- ============================================================================
-- AUDIT LOG (who did what — for security & dispute investigation)
-- ============================================================================
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_id);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);

-- ============================================================================
-- Enable Row-Level Security on every table (policies defined in migration 0002).
-- Default-deny: with RLS on and no policy, nothing is accessible — safe baseline.
-- ============================================================================
alter table profiles            enable row level security;
alter table cleaner_profiles    enable row level security;
alter table service_types       enable row level security;
alter table cleaner_services    enable row level security;
alter table properties          enable row level security;
alter table jobs                enable row level security;
alter table job_photos          enable row level security;
alter table quotes              enable row level security;
alter table messages            enable row level security;
alter table stripe_accounts     enable row level security;
alter table payments            enable row level security;
alter table completion_evidence enable row level security;
alter table reviews             enable row level security;
alter table disputes            enable row level security;
alter table dispute_evidence    enable row level security;
alter table documents           enable row level security;
alter table notifications       enable row level security;
alter table platform_settings   enable row level security;
alter table audit_logs          enable row level security;
