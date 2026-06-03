import type { Database } from "@/integrations/supabase/types";

export type RewardEvent = Database["public"]["Tables"]["reward_events"]["Row"];
export type CreditLedgerRow = Database["public"]["Tables"]["credit_ledger"]["Row"];
export type Payout = Database["public"]["Tables"]["payouts"]["Row"];
export type Founder = Database["public"]["Tables"]["founders"]["Row"];
export type ReferralCode = Database["public"]["Tables"]["codes"]["Row"];
export type ReferralAttribution = Database["public"]["Tables"]["referral_attributions"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}