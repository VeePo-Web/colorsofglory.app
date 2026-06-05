/**
 * Pricing API - all calls go through Supabase Edge Functions or direct table queries.
 * Maps exactly to Lovable's create-checkout, validate-code, billing-customer-portal,
 * me-referrals edge functions and the plan_tiers / subscriptions tables.
 */

import { supabase } from '@/integrations/supabase/client';

// Types

export type PlanKey = 'free' | 'starter' | 'pro';
export type SubPlan = 'free' | 'starter' | 'pro' | 'founder_pro';
export type PaymentEnvironment = 'sandbox' | 'live';

export interface PlanTier {
  key: PlanKey;                         // "free" | "starter" | "pro"
  displayName: string;                  // "Free" | "Starter" | "Pro"
  monthlyCents: number;                 // 0 | 500 | 10000
  currency: string;                     // "cad"
  ownedSongLimit: number;               // 1 | 4 | 50
  storageBytesIncluded: number;
  allowsFounderCode: boolean;
  allowsMemberReferral: boolean;
  allowsStorageAddons: boolean;
  stripePriceId: string | null;
  stripeReferralPriceId: string | null; // 50% off price
  sortOrder: number;
}

type PlanTierRow = {
  key: string;
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

export interface ValidateCodeResult {
  kind: 'founder' | 'member_referral' | 'invalid';
  // founder:
  discountPct?: number;           // 50
  effectiveCents?: number;        // 4900
  founderDisplayName?: string;
  codeId?: string;
  // member_referral:
  referrerDisplayName?: string;
  referrerUserId?: string;
  // invalid:
  reason?: string;
}

export interface CreateCheckoutResult {
  clientSecret: string | null;
  url: string | null;
  appliedCodeKind: 'founder' | 'member_referral' | 'none';
  ignoredReferrer: boolean;
  ignoredCode: boolean;
}

export interface CreateCheckoutInput {
  planKey: Exclude<PlanKey, 'free'>;
  code?: string | null;
  referrerCode?: string | null;
  returnUrl: string;
  environment?: PaymentEnvironment;
}

export interface BillingSubscriptionSummary {
  id: string;
  plan: SubPlan;
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  unitAmountCents: number;
  currency: string;
}

export interface BillingOverview {
  authenticated: boolean;
  currentPlan: SubPlan;
  subscription: BillingSubscriptionSummary | null;
}

export interface ReferralStats {
  code: string | null;
  link: string | null;
  attributedCount: number;
  payingCount: number;
  perReferralCents: number;
  monthlyRecurringCents: number;
  earnings: {
    pendingCents: number;
    payableCents: number;
    paidCents: number;
    lifetimeCents: number;
  };
  nextPayoutEstimateCents: number;
}

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  already_attributed: "You've already applied a code to this account.",
  code_exhausted: "That founder code has reached its limit.",
  exhausted: "That founder code has reached its limit.",
  forbidden: "This subscription belongs to a different account.",
  invalid_code: "That code didn't work. Check it and try again.",
  invalid_plan_key: "That plan is not available right now.",
  invalid_price_id: "That checkout option is not available right now.",
  invalid_return_url: "Checkout needs a fresh return link. Refresh and try again.",
  no_active_subscription: "We could not find an active subscription to manage.",
  no_customer: "We could not find billing details for this account yet.",
  plan_not_purchasable: "That plan is not available for checkout right now.",
  price_not_found: "That checkout price is not available right now.",
  return_url_missing_session_template: "Checkout needs a fresh return link. Refresh and try again.",
  storage_addons_require_pro: "Storage add-ons are available after Pro is active.",
  unauthorized: "Please sign in before changing billing.",
};

function normalizeCode(code?: string | null): string | undefined {
  const trimmed = code?.trim().toUpperCase();
  return trimmed || undefined;
}

function getPaymentEnvironment(): PaymentEnvironment {
  return import.meta.env.PROD ? 'live' : 'sandbox';
}

export function buildEmbeddedCheckoutReturnUrl(origin = window.location.origin): string {
  const cleanOrigin = origin.replace(/\/$/, '');
  return `${cleanOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
}

export function paymentErrorToMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return CHECKOUT_ERROR_MESSAGES[raw] ?? (raw.replace(/_/g, ' ') || 'Something went wrong. Please try again.');
}

// fetchPlanTiers

/** Load all purchasable tiers from the plan_tiers table, sorted by sort_order. */
export async function fetchPlanTiers(): Promise<PlanTier[]> {
  const { data, error } = await supabase
    .from('plan_tiers')
    .select(
      'key, display_name, monthly_cents, owned_song_limit, storage_bytes_included, ' +
      'allows_founder_code, allows_member_referral, allows_storage_addons, ' +
      'stripe_price_id, stripe_referral_price_id, sort_order, currency'
    )
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as PlanTierRow[];

  return rows.map((row) => ({
    key: row.key as PlanKey,
    displayName: row.display_name,
    monthlyCents: row.monthly_cents,
    currency: row.currency ?? 'cad',
    ownedSongLimit: row.owned_song_limit,
    storageBytesIncluded: row.storage_bytes_included,
    allowsFounderCode: row.allows_founder_code,
    allowsMemberReferral: row.allows_member_referral,
    allowsStorageAddons: row.allows_storage_addons,
    stripePriceId: row.stripe_price_id,
    stripeReferralPriceId: row.stripe_referral_price_id,
    sortOrder: row.sort_order,
  }));
}

// fetchCurrentPlan

/** Get the current user's active plan via the current_plan RPC. */
export async function fetchCurrentPlan(): Promise<SubPlan> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'free';

  const { data } = await supabase.rpc('current_plan', { _user_id: user.id });
  return (data as SubPlan) ?? 'free';
}

// canCreateSong

/** Returns true if the current user can create another owned song. */
export async function canCreateSong(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true; // allow in demo mode

  const { data } = await supabase.rpc('can_create_song', { _user_id: user.id });
  return data === true;
}

// fetchReferralStats

/** Load referral stats from the me-referrals edge function. */
export async function fetchReferralStats(): Promise<ReferralStats> {
  const { data, error } = await supabase.functions.invoke('me-referrals');
  if (error) throw error;

  return {
    code: data.code ?? null,
    link: data.link ?? null,
    attributedCount: data.attributed_count ?? 0,
    payingCount: data.paying_count ?? 0,
    perReferralCents: data.per_referral_cents ?? 500,
    monthlyRecurringCents: data.monthly_recurring_cents ?? 0,
    earnings: {
      pendingCents: data.earnings?.pending_cents ?? 0,
      payableCents: data.earnings?.payable_cents ?? 0,
      paidCents: data.earnings?.paid_cents ?? 0,
      lifetimeCents: data.earnings?.lifetime_cents ?? 0,
    },
    nextPayoutEstimateCents: data.next_payout_estimate_cents ?? 0,
  };
}

// validateCode

/**
 * Validate a founder or member-referral code before checkout.
 * Only works on plan_key = "pro".
 */
export async function validateCode(code: string, planKey = 'pro'): Promise<ValidateCodeResult> {
  const { data, error } = await supabase.functions.invoke('validate-code', {
    body: { code: code.trim().toUpperCase(), plan_key: planKey },
  });

  if (error) return { kind: 'invalid', reason: 'network_error' };

  return {
    kind: data.kind ?? 'invalid',
    discountPct: data.discount_pct,
    effectiveCents: data.effective_cents,
    founderDisplayName: data.founder_display_name,
    codeId: data.code_id,
    referrerDisplayName: data.referrer_display_name,
    referrerUserId: data.referrer_user_id,
    reason: data.reason,
  };
}

// createCheckout

/**
 * Create a Stripe checkout session via the create-checkout edge function.
 * Returns clientSecret for EmbeddedCheckout or url for redirect.
 *
 * @param planKey - plan_tiers.key ("starter" | "pro")
 * @param code    - optional founder code or member referral code
 * @param returnUrl - where Stripe redirects after payment
 */
export async function createCheckout(
  planKey: Exclude<PlanKey, 'free'>,
  code: string | null,
  returnUrl: string
): Promise<CreateCheckoutResult> {
  return createCheckoutSession({ planKey, code, returnUrl });
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  const body: Record<string, unknown> = {
    plan_key: input.planKey,
    returnUrl: input.returnUrl,
    environment: input.environment ?? getPaymentEnvironment(),
  };

  const manualCode = normalizeCode(input.code);
  const referrerCode = normalizeCode(input.referrerCode);

  if (manualCode) body.code = manualCode;
  if (referrerCode) body.referrer_code = referrerCode;

  const { data, error } = await supabase.functions.invoke('create-checkout', { body });

  if (error) throw new Error(paymentErrorToMessage(error.message ?? 'Checkout creation failed'));
  if (data?.error) throw new Error(paymentErrorToMessage(data.error));

  return {
    clientSecret: data.clientSecret ?? null,
    url: data.url ?? null,
    appliedCodeKind: data.applied_code_kind ?? 'none',
    ignoredReferrer: data.ignored_referrer ?? false,
    ignoredCode: data.ignored_code ?? false,
  };
}

// getBillingPortalUrl

/** Get Stripe customer portal URL so users can manage their subscription. */
export async function getBillingPortalUrl(returnUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('billing-customer-portal', {
    body: {
      returnUrl,
      environment: getPaymentEnvironment(),
    },
  });

  if (error) throw new Error(paymentErrorToMessage(error.message));
  if (data?.error) throw new Error(paymentErrorToMessage(data.error));
  if (!data?.url) throw new Error(paymentErrorToMessage('portal_session_failed'));

  return data.url as string;
}

export async function fetchBillingOverview(): Promise<BillingOverview> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      authenticated: false,
      currentPlan: 'free',
      subscription: null,
    };
  }

  const [planResult, subscriptionResult] = await Promise.all([
    supabase.rpc('current_plan', { _user_id: user.id }),
    supabase
      .from('subscriptions')
      .select('id, plan, status, current_period_end, cancelled_at, unit_amount_cents, currency')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (planResult.error) throw planResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;

  const sub = subscriptionResult.data;

  return {
    authenticated: true,
    currentPlan: (planResult.data as SubPlan) ?? 'free',
    subscription: sub
      ? {
          id: sub.id,
          plan: sub.plan as SubPlan,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelledAt: sub.cancelled_at,
          unitAmountCents: sub.unit_amount_cents,
          currency: sub.currency ?? 'cad',
        }
      : null,
  };
}

export async function cancelCurrentSubscription(atPeriodEnd = true): Promise<{
  ok: true;
  status: string;
  cancelAtPeriodEnd: boolean;
}> {
  const { data, error } = await supabase.functions.invoke('billing-cancel-subscription', {
    body: {
      at_period_end: atPeriodEnd,
      environment: getPaymentEnvironment(),
    },
  });

  if (error) throw new Error(paymentErrorToMessage(error.message));
  if (data?.error) throw new Error(paymentErrorToMessage(data.error));

  return {
    ok: true,
    status: data.status ?? 'active',
    cancelAtPeriodEnd: data.cancel_at_period_end ?? atPeriodEnd,
  };
}

// centsToDisplay

export function centsToDisplay(cents: number, currency = 'cad'): string {
  if (cents === 0) return '$0';
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  }
}
