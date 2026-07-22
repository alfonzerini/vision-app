-- ============================================================================
-- Vision — Seed data (migration 0003)
-- ============================================================================
-- Idempotent: safe to run more than once.

-- Service catalogue -----------------------------------------------------------
-- Window cleaning is the only ACTIVE service at launch. The future services are
-- pre-seeded as inactive so the roadmap is visible and enabling one is a single
-- flag flip (no schema change, no deploy).
insert into service_types (slug, name, description, is_active, sort_order) values
  ('window_cleaning',     'Window Cleaning',     'Interior and exterior window cleaning', true,  10),
  ('gutter_cleaning',     'Gutter Cleaning',     'Clearing and cleaning of gutters',      false, 20),
  ('pressure_washing',    'Pressure Washing',    'Driveways, patios and hard surfaces',   false, 30),
  ('roof_cleaning',       'Roof Cleaning',       'Roof cleaning and treatment',           false, 40),
  ('conservatory_cleaning','Conservatory Cleaning','Conservatory roof and frame cleaning', false, 50),
  ('solar_panel_cleaning','Solar Panel Cleaning','Cleaning of solar panels',              false, 60),
  ('fascia_soffit_cleaning','Fascia & Soffit Cleaning','Fascia and soffit cleaning',      false, 70),
  ('moss_removal',        'Moss Removal',        'Roof and surface moss removal',         false, 80),
  ('exterior_building_cleaning','Exterior Building Cleaning','Render and wall cleaning',   false, 90)
on conflict (slug) do nothing;

-- Configurable platform settings ---------------------------------------------
-- Business rules live here, never in code. Admins edit these from the dashboard.
insert into platform_settings (key, value, description) values
  ('commission_rate',        '0.15',   'Platform commission as a fraction of the job total (0.15 = 15%).'),
  ('review_window_hours',    '24',     'Hours a customer has to review before payment auto-releases.'),
  ('gps_radius_metres',      '200',    'A cleaner must be within this distance of the property to mark a job complete.'),
  ('min_after_photos',       '3',      'Minimum number of "after" photos required to complete a job.'),
  ('default_coverage_miles', '5',      'Default coverage radius for a new cleaner, in miles.'),
  ('default_currency',       '"gbp"',  'ISO currency code for all payments.'),
  ('quote_validity_hours',   '72',     'Default hours a submitted quote stays valid.')
on conflict (key) do nothing;
