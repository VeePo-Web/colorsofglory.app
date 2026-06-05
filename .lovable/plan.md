# Checkout Flow Audit Plan

Goal: clicking a paid tier on `/upgrade` reliably opens Stripe Embedded Checkout and a successful payment lands on `/checkout/success` with the subscription persisted. The current 401 (`bad_jwt / missing sub`) confirms the flow is broken before Stripe is ever called.

## 1. Reproduce + classify the current failure
- Confirm in network log: `POST /functions/v1/create-checkout` → 401 `{"error":"unauthorized"}` with anon JWT bearer (no `sub`).
- Confirm auth log: `bad_jwt / invalid claim: missing sub claim` → user is signed out on `/upgrade`.
- Conclusion: not a backend bug. UI lets unauthenticated users press "Go Pro".

## 2. Fix the auth gap on /upgrade (root cause of today's 401)
File: `src/pages/pricing/UpgradePage.tsx` (`handleSelectTier`).
- Call `supabase.auth.getUser()` (or read from an auth context) before `createCheckout`.
- If no user: `navigate("/login?next=/upgrade&plan=" + tier.key + (refCode ? "&ref=" + refCode : ""))` instead of invoking the function.
- After login, restore the intent: read `?next` + `?plan` and resume checkout automatically.
- Add a visible "Sign in to subscribe" CTA state on the cards so users aren't surprised.

## 3. Audit `createCheckout` request contract (frontend ↔ edge function)
File: `src/lib/pricing/pricingApi.ts` + `supabase/functions/create-checkout/index.ts`.
- `returnUrl` MUST contain `{CHECKOUT_SESSION_ID}` (server validates this; today the page sends `/checkout/success` with no template → would 400 even after auth is fixed). Change to:
  `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`.
- `environment`: `import.meta.env.PROD ? 'live' : 'sandbox'` is wrong for Lovable preview (preview is built `PROD` but uses the sandbox token). Derive from the token prefix via `getStripeEnvironment()` per the Stripe knowledge.
- Ensure `Authorization: Bearer <user JWT>` is attached. `supabase.functions.invoke` does this automatically when a session exists — verify after step 2 fix.
- Surface `ignored_code` from the response in the UI (today only `ignored_referrer` is read).

## 4. Audit the edge function itself (`create-checkout`)
- `getUser(token)` path uses service-role client with the user's bearer — verify it actually decodes user JWTs (preferred pattern: separate anon-keyed client with `global.headers.Authorization`). Today's 401 happened because the bearer was the anon key itself; once a real user JWT arrives, confirm `auth.getUser(token)` returns a user. Add a debug log on failure with the JWT `sub` for one-off diagnosis (then remove).
- Confirm `config.toml` does NOT require `verify_jwt = false` for `create-checkout` (gateway-level JWT check was passing today — the 401 was from the in-function `getUser`). Leave as-is.
- Re-test the validation branches we already hardened: `{CHECKOUT_SESSION_ID}` required, invalid plan_key, claim_founder_code_redemption atomicity, release on Stripe error, pending_code cleared.
- Verify `plan_tiers.stripe_price_id` rows have the `_cad` lookup keys present in Stripe (`prices.list({ lookup_keys })` returns ≥1). If Stripe lacks them → checkout returns 404 `price_not_found`. Action: call `payments--get_go_live_status` + list prices to confirm the three CAD prices exist in sandbox.

## 5. Audit `CheckoutModal` mount
File: `src/components/pricing/CheckoutModal.tsx`.
- Modal is rendered behind a `Suspense` boundary but `UpgradePage` never actually mounts it — `clientSecret` state is set but no `<Suspense><CheckoutModal …/></Suspense>` exists in JSX (verify lines 500–522 of UpgradePage that weren't read yet). If missing, add it with `onClose={() => setClientSecret(null)}`.
- Confirm `VITE_PAYMENTS_CLIENT_TOKEN` is present in `.env.development` (sandbox `pk_test_…`). Show the `PaymentTestModeBanner` pattern so unconfigured builds fail loudly.
- `loadStripe` is called at module scope — fine, but guard `null` token to avoid silent breakage.

## 6. Audit return / success flow
File: `src/pages/pricing/CheckoutSuccessPage.tsx`.
- Stripe will append `?session_id=…` once step 3's `returnUrl` is fixed. Read it, optionally call a `checkout-session-status` lookup to confirm `paid`, then navigate home. At minimum, log it so we can verify in network panel.
- Verify route `/checkout/success` is registered in `src/App.tsx` (read to confirm; if not → user lands on 404 after paying).

## 7. Verify the webhook persists the subscription
- After a sandbox test payment, query `subscriptions` for the test user: expect one row with `environment='sandbox'`, `status='active'`, correct `price_id` lookup key, and `current_period_end` in the future.
- Spot-check `billing_events` idempotency (re-trigger the same event from Stripe CLI / Dashboard → no duplicate row).
- Check `referral_attributions` row was inserted for founder/member code paths; `codes.redemption_count` incremented for founder.

## 8. End-to-end smoke test matrix
Run each with `supabase--curl_edge_functions` + a manual browser pass:
1. Signed-out user clicks Pro → redirected to /login (no 401).
2. Signed-in user, no code → checkout opens, pays with `4242…`, lands on success, subscription row appears.
3. Signed-in user, valid founder code → checkout shows $49 CAD, success, `referral_attributions.referrer_type='founder'`, redemption incremented.
4. Signed-in user, valid member referral code → checkout at $49 CAD, attribution row with `referrer_type='member'`.
5. Signed-in user, code on Starter → `ignored_code=true` in response, UI shows a note, checkout proceeds at $5.
6. Already-attributed user → 409 `already_attributed` surfaced as friendly error.
7. Exhausted founder code → 409 `code_exhausted`, no Stripe call (verify redemption count unchanged via `release_founder_code_redemption`).
8. Decline card `4000…0002` → modal stays, redemption released, no orphan attribution.

## 9. Logging + observability pass
- Add structured `console.log` in `create-checkout` for: resolved plan_key, priceId, applied_code_kind, customer id, session id. Keep concise; these surface in `edge_function_logs`.
- Frontend: log `clientSecret` presence (boolean only) + any error from `createCheckout` to the browser console with a `[checkout]` prefix.

## 10. Documentation + handoff
- Update `.lovable/payments-v2.md` "Known gaps" section with the auth-guard + returnUrl-template fixes and the smoke test results.
- Note the live-vs-sandbox env-derivation rule so future edits don't reintroduce the `import.meta.env.PROD` shortcut.

## Out of scope (this audit)
- Visual redesign of the Upgrade page (Claude owns).
- Multi-currency (CAD-only per memory).
- New plan tiers / pricing changes.
- Stripe go-live (separate workflow via `payments--get_go_live_status`).

## Deliverable
A passing run of the 8 smoke tests above, with screenshots of: signed-out redirect, embedded checkout modal, successful `/checkout/success?session_id=…`, and a `subscriptions` row in the DB.