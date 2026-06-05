# Payments verification + referral copy update

Two tracks. Track A is copy (small, deterministic). Track B is a full payments audit (verify every link from "click Upgrade" through Stripe webhook to subscription row).

---

## Track A — Copy change (UpgradePage.tsx)

Update three strings so the discount is framed as a **referral code (limited time)**, not a "founder code forever". `$100` language stays in the price-anchor sentence but is no longer tied to "founder".

1. **Line 43** — feature bullet inside Pro tier
   - From: `"Founder code: 50% off forever"`
   - To: `"50% off with referral code (limited time)"`

2. **Lines 99–100** — referred banner
   - From: `50% off Pro is yours – $49/month instead of $100.`
   - To: `50% off Pro with your referral code – $49/month instead of $100. Limited time.`

3. **Line 473** — code-entry header
   - From: `"Have a founder code?"`
   - To: `"Have a referral code?"`

4. **Line 520** — applied confirmation
   - Already says `Referral code applied - 50% off Pro is yours.` → append ` Limited time.`

No logic changes. `codeResult.kind === "founder"` and `"member_referral"` discount paths stay intact server-side; only user-facing copy moves to "referral code".

---

## Track B — Payments audit (does checkout actually work?)

Goal: prove that a real signed-in user can click **Upgrade → Pro**, complete Stripe sandbox checkout, and end up with an `active` row in `public.subscriptions` filtered by `environment='sandbox'`, with the app reflecting Pro tier on next render.

### B1. Static audit (read-only, no edits)

Read and cross-check:

- `src/pages/pricing/UpgradePage.tsx` — `handleSelectTier` flow, auth-gate, `sessionStorage` resume.
- `src/lib/pricing/pricingApi.ts` — `createCheckout`, `getBillingPortalUrl`, env passed (`getStripeEnvironment()`).
- `src/lib/stripe.ts` — `getStripeEnvironment` derivation.
- `supabase/functions/create-checkout/index.ts` — JWT validation, env routing, `lookup_key` resolution, `managed_payments`/`automatic_tax`, `return_url` shape.
- `supabase/functions/payments-webhook/index.ts` — signature verification, `?env=` parsing, upsert into `subscriptions`, `price_id` resolution order (`lookup_key` → `lovable_external_id` → `price.id`).
- `supabase/functions/validate-code/index.ts` — discount math + `kind` returned.
- `supabase/functions/apply-founder-code-to-active-sub/index.ts` — post-purchase discount path.
- `subscriptions` table policies + `has_active_subscription` function.
- `src/pages/pricing/CheckoutSuccessPage.tsx` — session_id handling, refetch + nav.

Confirm:
- Every server read of `subscriptions` includes `.eq('environment', getStripeEnvironment())`.
- Tier gating keys off `price_id` (lookup_key), never `product_id`.
- No `STRIPE_SECRET_KEY` references; all Stripe calls go through `createStripeClient(env)`.
- Webhook is registered (it is — managed by `enable_stripe_payments`).

### B2. Confirm products + prices exist

Check via `payments-` tooling that the following prices exist with the expected `lookup_key`s referenced in `create-checkout`:
- `pro_monthly` ($100/mo)
- `pro_yearly` (if shown)
- any add-on / storage SKUs the UI exposes

If missing or mis-priced, recreate via `payments--create_price` (sandbox auto-syncs to live on publish).

### B3. Edge function smoke (sandbox)

Using `supabase--curl_edge_functions` while signed in to preview:

1. `POST /create-checkout` with `{ tierKey: "pro_monthly", code: null }` → expect `{ url, sessionId }`.
2. `POST /create-checkout` with a known valid referral code → expect discounted line item or coupon attached.
3. `POST /validate-code` with valid + invalid + expired codes → expect correct `kind` + `discountPercent`.
4. `POST /create-checkout` unauthenticated → expect 401 (matches the earlier bug we fixed).

### B4. Manual browser pass (operator)

In preview, signed in as a fresh test account:

1. `/upgrade` → click **Pro** with no code → Stripe sandbox checkout opens with $100/mo.
2. Pay with `4242 4242 4242 4242`, any future date, any CVC, any ZIP.
3. Land on `/checkout/success?session_id=…` → success copy renders, redirect after 3s.
4. Realtime: `subscriptions` row appears (`status=active`, `environment=sandbox`, `price_id=pro_monthly`).
5. `/upgrade` now shows Pro as current plan, **Manage billing** opens portal in new tab.
6. Repeat with a referral code → checkout shows 50% off → row stores discount metadata.
7. Repeat the entire flow logged out → auth gate redirects to `/auth/login`, OTP verify, then auto-resumes checkout via `cog:pending-checkout`.

### B5. Edge cases to verify

- User already has active sub → "Upgrade" CTA is replaced with "Manage billing" (no duplicate sub created).
- Webhook arrives before user lands on success page → row is upserted; success page refetch picks it up.
- Webhook with bad signature → 400; nothing inserted.
- `?env=live` webhook in preview → ignored cleanly (200 + `ignored:"invalid env"`), nothing inserted.
- `apply-founder-code-to-active-sub` on an active sub → coupon applied, `current_period_end` unchanged.

### B6. Failure-mode triage

If any step in B4 breaks, the most likely culprits in order:
1. Missing `lookup_key` on price → `create-checkout` returns 400.
2. `return_url` missing `{CHECKOUT_SESSION_ID}` template → success page can't show details.
3. Webhook handler not reading `?env=` → row inserted with default `'sandbox'` but client filters by `'live'` (or vice-versa).
4. RLS on `subscriptions` blocking client `select` (should allow `auth.uid() = user_id`).
5. `getStripeEnvironment()` mismatch with the env the webhook stamps.

Each is fixable without schema changes — fixes go into the relevant edge function or `src/lib/stripe.ts`.

---

## What lands as code (after plan approval)

- **Frontend only** for Track A: 4 string edits in `src/pages/pricing/UpgradePage.tsx`.
- **No edits** for Track B until the audit finds a concrete defect; then fixes are scoped to the exact edge function or pricing helper, never schema.
- Track B report posted back here as a green/red checklist.

## Out of scope

- Going live on Stripe (separate go-live flow).
- New plan tiers, currencies, or seat-based pricing.
- Visual redesign of the upgrade page.
- Twilio / OTP work (already covered).
