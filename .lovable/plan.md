# Payments v2 audit — findings + fix plan

Audited `validate-code`, `create-checkout`, `payments-webhook`, plus the closely-coupled `apply-founder-code-to-active-sub` and `_shared/stripe.ts`. Most of the v2 brief is satisfied. The issues below are real bugs or spec gaps, ordered by severity.

## Critical (will break flows today)

1. **`apply-founder-code-to-active-sub` uses the dead USD lookup key.** After the CAD switch, `plan_tiers.stripe_referral_price_id = 'pro_monthly_referral_50_cad'`, but this function still calls `stripe.prices.list({ lookup_keys: ["pro_monthly_referral_50"] })`. The old USD price was archived — the call returns empty and the function 500s with `referral_price_missing`. Fix: read `plan_tiers` (key='pro') and use `stripe_referral_price_id`.

2. **`create-checkout` uses `ui_mode: "embedded_page"`.** Stripe Checkout's accepted values for `ui_mode` are `hosted`, `embedded`, `custom`. `embedded_page` is not a documented value and will be rejected by the Stripe API (or silently fall back). The Lovable checkout knowledge file (stripe-checkout) uses `ui_mode: "embedded"`. Fix: change to `"embedded"`.

3. **`return_url` not validated for the embedded `{CHECKOUT_SESSION_ID}` template.** Embedded mode requires the placeholder; without it the post-payment redirect breaks. Fix: when `ui_mode='embedded'`, require `returnUrl` to contain `{CHECKOUT_SESSION_ID}`.

## High (silent data corruption / race conditions)

4. **Founder code `max_redemptions` race.** `create-checkout` reads `redemption_count`, creates the Stripe session, then calls `increment_founder_code_redemption`. Two concurrent buyers can both pass the cap. Fix: move the increment + cap check into a single SECURITY DEFINER RPC that does `UPDATE … WHERE redemption_count < max_redemptions RETURNING …` atomically, called *before* `stripe.checkout.sessions.create`. Roll back (decrement) if Stripe throws.

5. **`billing_events` insert is not idempotent.** The handler reads `billing_events` by `external_event_id`, and only short-circuits when `processed_at IS NOT NULL`. If two webhook retries land concurrently (Stripe does retry), the second `INSERT` violates the unique constraint and the function 500s — Stripe then retries again, log noise compounds. Fix: change to `upsert({ ... }, { onConflict: 'external_event_id', ignoreDuplicates: true })`, or wrap the existing check + insert in `ON CONFLICT DO NOTHING`.

6. **`upsertStorageAddon` accepts a null lookup_key.** When `lookupKey` is null/empty the row is written with `lookup_key=''` and `bytes_granted=0`. Pro user's add-on silently grants nothing. Fix: if `bytesForStorageLookupKey()` returns 0, log + skip (don't write the row), and surface the unknown key the same way `planForLookupKey` does.

7. **`record_invoice_paid` currency casing.** Webhook passes `invoice.currency ?? "cad"` (Stripe returns lowercase `cad`); `plan_tiers.currency` is stored as uppercase `CAD`. Anywhere downstream that joins or compares these will mismatch. Fix: normalize one direction — store lowercase everywhere (Stripe convention), update `plan_tiers` rows to `cad`.

## Medium (spec drift, not user-facing yet)

8. **`validate-code` hardcodes `effective_cents: 4900`.** Brief says all pricing flows through `plan_tiers`. After a future price change this returns the wrong number. Fix: read `plan_tiers` (key='pro') and compute from `monthly_cents * 0.5` or read a new column for the referral price.

9. **`validate-code` doesn't check founder code `max_redemptions` and `expires_at` consistently with create-checkout.** It does check both — good. But it doesn't check the founder code is still active *and* the founder's `user_id != user.id` for the member-referral branch (it does for founder branch). Fix: add `self` check on member referral (already done — confirmed). False alarm.

10. **`apply-founder-code-to-active-sub` regex `^[A-Z0-9_-]{4,32}$`** rejects codes shorter than 4 chars; the codes table has no such constraint. Fix: relax to `{1,64}` or remove and rely on the DB lookup to fail.

11. **`create-checkout` "invalid_code" branch only fires when `tier.allows_founder_code`.** On Starter (`allows_founder_code=false`, `allows_member_referral=false`) any user-supplied code is silently swallowed. Brief §6 says Starter blocks codes, but should surface `code_ignored_on_starter` so the UI can warn. Fix: when `planKey='starter'` and any code is present, set `ignored_code=true` in the response.

12. **`pending_code` not cleared on successful Starter checkout** (since `appliedCodeKind === 'none'`). A stale code sits on the profile forever. Fix: always clear `pending_code` after a successful session create, regardless of attribution kind.

## Low (cosmetic / future-proofing)

13. **No `customer.subscription.paused` handling.** Stripe can pause subs; we'd still treat them as active. Add an explicit case that marks the row `status='paused'`.

14. **`charge.dispute.created` reads `charge.invoice` directly** — newer Stripe API may not include it; expand the lookup the way `handleInvoicePaid` does (via `payment_intent` → invoice).

15. **`plan_tiers` lookup keys still reference removed price IDs from `_shared/stripe.ts`** — `planForLookupKey` keeps both USD and CAD aliases. Fine as a safety net; flag the USD keys with a `// TODO remove after no in-flight USD subs` comment so they're cleanable later.

## Out of scope

- Frontend pricing page, embedded checkout mount, error copy — Claude's pass.
- Multi-currency (USD + CAD side-by-side).
- `src/pages/**`, `src/components/**`.

---

## Fix plan (execution order)

### Step 1 — Critical bugs
- **`apply-founder-code-to-active-sub`**: fetch `plan_tiers` row for `pro`, use `stripe_referral_price_id` as the lookup key (fallback to `pro_monthly_referral_50_cad`).
- **`create-checkout`**: change `ui_mode: "embedded_page"` → `"embedded"`; validate `returnUrl` contains `{CHECKOUT_SESSION_ID}` when embedded.

### Step 2 — Idempotency + race conditions
- New migration: SECURITY DEFINER RPC `claim_founder_code_redemption(_code_id uuid)` that atomically increments only if under cap, returns boolean. Grant to `service_role`.
- `create-checkout`: call the new RPC *before* `stripe.checkout.sessions.create`; if false → return `code_exhausted`. On Stripe failure, call a `release_founder_code_redemption` RPC to decrement.
- `payments-webhook`: replace `recordBillingEvent` insert with `upsert(..., { onConflict: 'external_event_id', ignoreDuplicates: true })`.

### Step 3 — Storage add-on + currency hygiene
- `payments-webhook` `upsertStorageAddon`: if `bytesForStorageLookupKey()` returns 0, log + skip the insert; surface error like `planForLookupKey`.
- Migration: `UPDATE plan_tiers SET currency='cad'` (lowercase to match Stripe).

### Step 4 — Spec drift cleanup
- `validate-code`: read `plan_tiers` for Pro and compute `effective_cents` from `monthly_cents * 0.5` (or add a column).
- `create-checkout`: always call `clear_pending_code` after a successful session create; add `ignored_code` to response when Starter receives any code.
- `apply-founder-code-to-active-sub`: relax code regex.

### Step 5 — Future-proofing (low priority, batch in same PR)
- Add `customer.subscription.paused` case.
- Expand `charge.dispute.created` invoice lookup.
- Comment the USD lookup-key aliases in `_shared/stripe.ts`.

### Step 6 — Verify
- `supabase--curl_edge_functions` smoke tests:
  - `validate-code` happy + `wrong_plan` + `self` + `already_attributed`
  - `create-checkout` Pro-no-code / Pro-founder / Pro-referrer / Pro-both / Starter-with-code (should set `ignored_code`)
  - `apply-founder-code-to-active-sub` with a live Pro sub (sandbox)
- Replay a Stripe `checkout.session.completed` and confirm `billing_events` row + `referral_attributions` row + idempotent re-replay.

### Step 7 — Doc
- Append "v2 audit fixes 2 (2026-06-04)" section to `.lovable/payments-v2.md` listing each fix above.

## Risk

- Atomic redemption RPC change requires a migration; once deployed, a Stripe session-create failure must trigger the release RPC or the count drifts. Mitigation: try/catch around `sessions.create`.
- Lowercasing `plan_tiers.currency` requires updating any frontend that string-matches on `CAD`; Claude's pricing page reads `pricing_copy` directly, so safe.
- `ui_mode` change requires Claude's embedded mount to use the same string — confirm before shipping if frontend is already wired.
