// Billing / plans / storage domain types (MONEY — distinct from songwriting
// Credits, which are greenfield in ./credit and NEVER conflated with this).
//
// PROVENANCE:
//   Subscription  — 1:1 ROW ALIAS of public.subscriptions.
//   StorageAddon  — 1:1 ROW ALIAS of public.storage_addons.
//   BillingStatus — COMPOSED server read shape (billing-status edge fn): plan +
//                   is_pro + nested subscription / storage meter / addons[] /
//                   song_quota, aggregated across subscriptions, storage_addons,
//                   plan_tiers, and owned-song counts. Not a single row.
//   PlanTier / PricingCard — COMPOSED read shapes over plan_tiers + pricing copy.
//   PlanId / PlanKey — plan vocabularies; StorageUsage — storage meter shape.
// The pricing-copy and code-validation DTOs stay with their callers in cog/billing.ts.
import type { Database } from "@/integrations/supabase/types";
import type { SubPlan } from "./enums";

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type StorageAddon = Database["public"]["Tables"]["storage_addons"]["Row"];

// PlanId is the billing plan actually held; it IS the DB `sub_plan` enum, so it
// derives from the canonical `SubPlan` (./enums) rather than forking the union.
export type PlanId = SubPlan;
// PlanKey is the purchasable plan_tiers.key column (a text key, not a DB enum).
export type PlanKey = "free" | "starter" | "pro";

export type BillingStatus = {
  authenticated: boolean;
  user_id: string | null;
  plan: PlanId;
  is_pro: boolean;
  subscription: {
    id: string;
    plan: PlanId;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    cancelled_at: string | null;
    unit_amount_cents: number;
    currency: string;
  } | null;
  storage: {
    used_bytes: number;
    included_bytes: number;
    addon_bytes: number;
    limit_bytes: number;
    pct_used: number;
  };
  addons: Array<{
    id: string;
    bytes: number;
    status: string;
    current_period_end: string | null;
  }>;
  song_quota: { owned_limit: number; can_create_song: boolean };
};

export type PlanTier = {
  key: PlanKey;
  display_name: string;
  monthly_cents: number;
  currency: string;
  owned_song_limit: number;
  storage_bytes_included: number;
  allows_founder_code: boolean;
  allows_member_referral: boolean;
  allows_storage_addons: boolean;
  stripe_price_id: string | null;
  stripe_referral_price_id: string | null;
  sort_order: number;
};

export type PricingCard = {
  plan_key: PlanKey;
  eyebrow: string;
  name: string;
  price_display: string;
  price_suffix: string;
  discounted_price_display?: string;
  discount_badge?: string;
  headline: string;
  subhead: string;
  bullets: string[];
  cta_label: string;
  cta_label_with_code?: string;
  cta_kind: "free" | "subscribe" | "subscribe_with_code";
  trust_line?: string;
  most_popular?: boolean;
};

/** Storage meter: bytes used vs. effective limit for the signed-in user. */
export interface StorageUsage {
  bytesUsed: number;
  bytesLimit: number;
}
