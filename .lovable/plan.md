## Stripe Payments — Lovable Seamless Integration

Enable Lovable's built-in Stripe, create the COG plan-tier products, and ship the SDK + edge functions + thin checkout component so Claude Code can drop `<StripeEmbeddedCheckout priceId="pro_monthly" />` anywhere without touching backend.

### 1. Enable + products

- `enable_stripe_payments` (managed by Lovable, no keys for user to manage).
- `batch_create_product` with tax code `txcd_10103001` (SaaS):
  - `pro_plan` → `pro_monthly` $9/mo, `pro_yearly` $90/yr (single-purchase, qty 1/1)
  - `storage_addon_50gb` → `storage_addon_50gb_monthly` $4/mo (single-purchase)
- Update each product with `tax_code` via Stripe API call from a one-shot setup script in `supabase/functions/_setup/set-tax-codes.ts` (or inline at product creation — `batch_create_product` doesn't take tax_code, so a follow-up `stripe.products.update` is required).

### 2. Backend (Lovable lane)

**Files to create:**
- `supabase/functions/_shared/stripe.ts` — verbatim `createStripeClient` + `verifyWebhook` from knowledge.
- `supabase/functions/create-checkout/index.ts` — embedded mode, `managed_payments: { enabled: true }`, resolves Customer with `metadata.userId`, sets `payment_intent_data.description` for one-offs, subscription_data.metadata for recurring.
- `supabase/functions/create-portal-session/index.ts` — billing portal, auth-guarded.
- `supabase/functions/payments-webhook/index.ts` — handles `customer.subscription.{created,updated,deleted}` and `checkout.session.completed`, upserts into `subscriptions`, env-stamped.
- `supabase/config.toml` — `verify_jwt = false` for `create-checkout`, `create-portal-session`, `payments-webhook`.

**Migration** (`subscriptions` table + `has_active_subscription` RPC) per knowledge schema, with GRANTs + RLS. Note: `subscriptions` table already exists in current schema (`<supabase-tables>`); migration will `ALTER TABLE` to add any missing columns (`environment`, `cancel_at_period_end`, `product_id`, `price_id` if missing) and create the helper function.

### 3. Frontend (thin, for Claude Code consumption)

**Files to create:**
- `src/lib/stripe.ts` — `getStripe()` + `getStripeEnvironment()` derived from `VITE_PAYMENTS_CLIENT_TOKEN` prefix; throws on missing token (no silent `live` fallback).
- `src/components/cog/StripeEmbeddedCheckout.tsx` — `<EmbeddedCheckoutProvider>` wrapping `<EmbeddedCheckout>`, calls `create-checkout` edge function via `supabase.functions.invoke`.
- `src/hooks/useStripeCheckout.tsx` — returns `{ openCheckout, closeCheckout, checkoutElement }`.
- `src/hooks/useSubscription.ts` — TanStack Query hook reading `subscriptions` table with `getStripeEnvironment()` filter, exposes `{ subscription, isActive, tier, isLoading }`.
- `src/components/cog/PaymentTestModeBanner.tsx` — shows orange test-mode banner in sandbox, red "go-live required" banner if token missing.
- `src/pages/CheckoutReturn.tsx` — reads `session_id`, shows success state, navigates to catalog. (Single page — Claude can restyle to match COG cream/gold; structurally minimal.)

**SDK additions in COG lane** (`src/integrations/cog/`):
- `src/integrations/cog/billing.ts` — typed wrappers: `openProCheckout(interval)`, `openStorageAddonCheckout()`, `openCustomerPortal()`, `getActiveTier()`. This is the only file Claude Code needs to import from.

**Deps:** `@stripe/stripe-js@9.2.0` + `@stripe/react-stripe-js@6.2.0`.

### 4. Plan-gate enforcement (server-side)

Already-deployed `create-song` edge function: add a free-tier check that calls `has_active_subscription(user_id, 'live')` (and `'sandbox'` for previews) before allowing a 2nd active owned song. Update `.lovable/plan.md` to mark Payments step done.

### 5. Handoff doc for Claude Code

`docs/claude-handoffs/2026-06-21-payments.md` documenting:
- Where to call `openProCheckout('monthly' | 'yearly')` from `/upgrade` and storage warning screens.
- Where to mount `<PaymentTestModeBanner />` (top of root layout).
- How to read `useSubscription()` to gate UI.
- Return URL convention: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`.
- Reminder that all styling, copy, and screen design stays in Claude's lane — the new components are unstyled scaffolds.

### Out of scope

- Designing `/upgrade` page visuals (Claude Code).
- Storage warning screen visuals (Claude Code).
- Referral payout logic (separate phase — already partial in DB).
- Founder code stacking with Stripe coupons (separate phase).

### Build order

1. Enable Stripe + create products + set tax codes.
2. Migration (subscriptions table delta + RPC).
3. Shared utility + 3 edge functions + config.toml.
4. Install deps + write 5 frontend files + COG SDK wrapper.
5. Wire plan-gate into `create-song`.
6. Update `.lovable/plan.md` + write Claude handoff doc.
