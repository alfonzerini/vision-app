/**
 * App-wide constants: branding and route paths.
 * Business RULES (commission %, review window, etc.) do NOT live here — they are
 * configurable in the database `platform_settings` table.
 */

export const BRAND = {
  name: "Vision",
  tagline: "Spotless windows, sorted.",
  description:
    "Vision connects UK homeowners with trusted local window cleaners. Post a job, compare quotes, pay securely — done.",
  // Colours taken from the Vision app logo (blue + yellow squeegee).
  colors: {
    blue: "#1E90FF",
    blueDark: "#1565C0",
    yellow: "#FFC400",
  },
} as const;

/** Fallback business defaults, used only if the DB settings can't be read. */
export const SETTINGS_DEFAULTS = {
  commission_rate: 0.15,
  review_window_hours: 24,
  gps_radius_metres: 200,
  min_after_photos: 3,
  default_coverage_miles: 5,
  default_currency: "gbp",
  quote_validity_hours: 72,
} as const;

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  customerDashboard: "/customer",
  cleanerDashboard: "/cleaner",
  adminDashboard: "/admin",
} as const;
