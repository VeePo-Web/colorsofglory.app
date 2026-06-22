## Goal
Add one server endpoint that returns the signed-in user's current plan + subscription + storage status, so any screen (canvas, upgrade, settings, gates) can read a single source of truth instead of stitching together `current_plan`, `subscriptions`, `storage_addons`, and `effective_storage_limit` on the client.

## Endpoint

`supabase/functions/me-billing-status/index.ts` (Lovable-managed, `verify_jwt = false`, validates JWT in code via `supabase.auth.getClaims`).

**Method:** `POST` (no body required).

**Response shape:**
```ts
{
  authenticated: boolean;
  user_id: string | null;
  plan: "free" | "starter" | "pro" | "founder_pro";
  is_pro: boolean;             // current_plan in {pro, founder_pro} OR active grace
  environment: "sandbox" | "live" | null;
  subscription: {
    id: string;
    plan: "free" | "starter" | "pro" | "founder_pro";
    status: string;            // active | trialing | past_due | canceled | ...
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    cancelled_at: string | null;
    unit_amount_cents: number;
    currency: string;
  } | null;
  storage: {
    used_bytes: number;
    included_bytes: number;    // plan base
    addon_bytes: number;       // sum of active add-ons
    limit_bytes: number;       // effective_storage_limit RPC
    pct_used: number;          // 0..1, clamped
  };
  addons: Array<{
    id: string;
    bytes: number;
    status: string;
    current_period_end: string | null;
  }>;
  song_quota: {
    owned_limit: number;       // from plan_tiers
    can_create_song: boolean;  // can_create_song RPC
  };
}
```

Unauthenticated callers get `{ authenticated: false, plan: "free", ... }` with zeroed storage — never throws.

## Implementation notes

- Uses the shared Supabase client with the user's `Authorization` header so RLS applies.
- Internally calls in parallel: `rpc('current_plan')`, `rpc('is_pro_user')`, `rpc('effective_storage_limit')`, `rpc('can_create_song')`, plus selects from `subscriptions` (latest by `updated_at`, filtered by `environment = getStripeEnvironment()` — accepts `?env=sandbox|live` query, defaults to `sandbox`), `storage_addons` (active/trialing/past_due), `storage_usage`, and `plan_tiers` (for `owned_song_limit` + `storage_bytes_included`).
- CORS headers on every response; OPTIONS short-circuit.
- No new tables, no migrations, no schema changes.

## Thin SDK wrapper

Add to `src/integrations/cog/billing.ts`:

```ts
export type BillingStatus = { /* mirror of the response */ };
export async function getMyBillingStatus(env?: "sandbox" | "live"): Promise<BillingStatus>;
```

Calls the edge function via `supabase.functions.invoke('me-billing-status', { body: { environment: env ?? getStripeEnvironment() } })`.

## Hook update

Refactor `src/hooks/useSubscription.ts` to fetch from `getMyBillingStatus()` instead of querying `subscriptions` + `storage_addons` directly. Keep the existing return shape additive — same fields still present, plus new `status: BillingStatus` for richer consumers. Realtime channels on `subscriptions` and `storage_addons` continue to trigger refetch.

## Out of scope

- No UI changes.
- No new RLS policies (uses existing RPCs + user-scoped reads).
- No Stripe API calls (DB is the source of truth; webhook keeps it fresh).
- No changes to `create-checkout`, `payments-webhook`, `billing-customer-portal`.

## Files touched

- `supabase/functions/me-billing-status/index.ts` (new)
- `src/integrations/cog/billing.ts` (add `getMyBillingStatus` + type)
- `src/hooks/useSubscription.ts` (refactor to use the new endpoint)
- `docs/claude-handoffs/2026-06-22-payments.md` (append one section documenting the endpoint)
