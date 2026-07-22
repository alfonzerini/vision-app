/**
 * Shared domain types. These mirror the database enums in
 * supabase/migrations/20260722090001_init_schema.sql. Keep them in sync.
 * (Later we can auto-generate full DB types from Supabase.)
 */

export type UserRole = "customer" | "cleaner" | "admin";

export type JobStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_review"
  | "completed"
  | "disputed"
  | "cancelled";

export type CleanType = "inside" | "outside" | "both";

export type QuoteStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export type PaymentStatus =
  | "requires_payment"
  | "held"
  | "released"
  | "refunded"
  | "partially_refunded"
  | "failed";

export type DisputeReason =
  | "no_show"
  | "poor_quality"
  | "incomplete"
  | "property_damage";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_customer"
  | "resolved_cleaner"
  | "cancelled";

export type DocumentType =
  | "public_liability_insurance"
  | "id_verification"
  | "vehicle"
  | "other";

export type NotificationType =
  | "new_quote"
  | "quote_accepted"
  | "payment_successful"
  | "cleaner_assigned"
  | "job_reminder"
  | "job_complete"
  | "review_reminder"
  | "payment_released"
  | "dispute_raised"
  | "dispute_resolved"
  | "new_message";

/** Keys of the configurable platform_settings table. */
export interface PlatformSettings {
  commission_rate: number; // 0.15 = 15%
  review_window_hours: number;
  gps_radius_metres: number;
  min_after_photos: number;
  default_coverage_miles: number;
  default_currency: string;
  quote_validity_hours: number;
}
