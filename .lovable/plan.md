
## Audit findings (what's still wrong or missing)

I re-read the v2 implementation (migrations, `_shared/stripe.ts`, `create-checkout`, `validate-code`, `payments-webhook`, `apply-founder-code-to-active-sub`, `billing.ts`, `plan_tiers`, `pricing_copy`) and re-ran the brief against it. Most of the heavy lifting is done. The remaining gaps:

### Currency (the new ask)
- `plan_tiers.currency = 'USD'` for all three rows.
- Stripe products `cog_starter`, `cog_pro`, `cog_pro_referral` were created with **`currency: 'usd'`** via `payments--batch_create_product`. Stripe prices are immutable — you cannot change a price's currency. Must create **new CAD prices** alongside.
- `pricing_copy` strings reference "$5", "$49", "$100" without a currency marker. Should read "$5 CAD" (or be CAD-labeled in the page copy) so a US visitor isn't confused.

### Stripe price lookup-key collision
- Lookup keys are unique per active price. Re-creating `starter_monthly` / `pro_monthly` / `pro_monthly_referral_50` in CAD requires either (a) archiving the USD prices and reusing the keys, or (b) using new keys (`starter_monthly_cad`, etc.). Option (a) is cleaner — the USD prices have zero subscribers (test mode, just created) so archiving is safe. We'll go with (a) and reuse the same lookup keys, so no edge-function code has to change.

### Real gaps from the brief that are still open
1. **`getPricingPage()` SDK return shape doesn't include the FAQ array** the brief specified (`{ page, cards, faq }`). Currently returns `{ page, cards }`. Need to add a `faq` JSONB row in `pricing_copy` and surface it.
2. **`getMySubscription`, `getMyFounderStats`, `purchaseStorageAddon`** named aliases from §7 of the brief still don't exist on the SDK (only the older `getLatestSubscription`, `canPurchaseFounderRate`, etc.). Add thin alias exports so Claude can consume the brief's exact names.
3. **`validate-code` doesn't check `wrong_plan`** when a founder code is presented with `plan_key !== 'pro'` — it returns generic `not_found`. Tighten to return `reason: 'wrong_plan'`.
4. **`payments-webhook` does not pass `currency`** from the Stripe invoice into `record_invoice_paid` calls — `billing_events.currency` will silently be wrong for CAD invoices. Read `invoice.currency` and pass through.
5. **`create-checkout` doesn't set `currency: 'cad'`** on `mode: 'subscription'` sessions. Stripe will use the price's currency, but for any safety net (e.g. `price_data` fallbacks) we should explicitly pin CAD. Audit and pin.
6. **Smoke tests** (`supabase--curl_edge_functions`) were proposed but never run end-to-end against `validate-code`, `create-checkout` (all three branches), and `apply-founder-code-to-active-sub`. Run them after currency switch.

### Things I verified are fine (no change needed)
- `invoice.subscription` deprecation fix is in place.
- `verify_jwt = false` set on `create-checkout`, `validate-code`, `redeem-founder-code`, `payments-webhook`, `apply-founder-code-to-active-sub`.
- `referral-attach` rewritten to stash on `profiles.pending_code`, no premature attribution writes.
- One-code-per-buyer enforced in `create-checkout`.
- Founder redemption count increments on successful session create.
- Storage-addon Pro-gate in place.
- `_shared/stripe.ts` `planForLookupKey` throws on unknown keys (loud-fail).
- `is_song_member` policies + `songs.status='locked'` lock-on-downgrade logic working via `apply_song_lock_for_quota`.

---

## Plan to fix (CAD switch + remaining gaps)

### Step 1 — Stripe: recreate prices in CAD, reuse lookup keys
1. Archive the existing USD prices on `cog_starter`, `cog_pro`, `cog_pro_referral` (zero subscribers, safe).
2. Create new CAD prices via `payments--create_price` with the **same `id` / lookup-key** values: `starter_monthly` ($5 CAD), `pro_monthly` ($100 CAD), `pro_monthly_referral_50` ($49 CAD). Recurring monthly, qty 1/1.
3. No edge-function changes required — `_shared/stripe.ts` resolves prices by lookup key.

### Step 2 — Migration: flip `plan_tiers.currency` to `CAD`
```sql
UPDATE public.plan_tiers SET currency = 'CAD' WHERE key IN ('free','starter','pro');
```
(Using `supabase--insert` since this is a data update on an existing table, no schema change.)

### Step 3 — Update `pricing_copy` strings to read CAD
Update the three card payloads + page payload so prices display as "$5 CAD", "$49 CAD", "$100 CAD", and add a one-line trust marker on the page header: "All prices in Canadian dollars." Done via `supabase--insert` UPDATE.

### Step 4 — Add `faq` row to `pricing_copy` + surface in SDK
- Insert a `faq` row with a JSONB array of `{q, a}` items (e.g. "Why is the first song free?", "What happens if I downgrade?", "How do founder codes work?", "Do referral codes stack with founder codes?").
- Update `getPricingPage()` in `src/integrations/cog/billing.ts` to return `{ page, cards, faq }`.

### Step 5 — SDK alias exports (§7 names)
Add to `src/integrations/cog/billing.ts`:
- `export const getMySubscription = getLatestSubscription;`
- `export const getMyFounderStats = ...` (compose from existing helpers)
- `export const purchaseStorageAddon = createStorageAddonCheckout;` (or matching name)

### Step 6 — Tighten `validate-code`
Return `reason: 'wrong_plan'` when a founder code is presented with `plan_key !== 'pro'`. (Currently the function only accepts `plan_key='pro'` in its schema, but the error message is generic — make it explicit so the UI can show the right copy.)

### Step 7 — Pass invoice currency through `payments-webhook`
In `handleInvoicePaid`, read `invoice.currency` (lowercased) and pass it into `record_invoice_paid` / `billing_events` writes so CAD invoices store `currency='cad'`, not USD.

### Step 8 — Pin `currency: 'cad'` defensively in `create-checkout`
Audit the `stripe.checkout.sessions.create({...})` payload — if any `price_data` fallback exists, pin `currency: 'cad'`. (Lookup-key path already uses the price's own currency.)

### Step 9 — Smoke tests via `supabase--curl_edge_functions`
- `validate-code` with: valid founder code, valid member referral code, invalid code, starter plan_key.
- `create-checkout` with: starter / pro-no-code / pro-with-founder-code / pro-with-referrer / pro-with-both.
- `apply-founder-code-to-active-sub` with a mocked active sub.
- `payments-webhook` not directly callable; verify by checking `billing_events` after a sandbox `checkout.session.completed` is replayed.

### Step 10 — Update `.lovable/payments-v2.md`
Add a "CAD switch" section: new Stripe price IDs (same lookup keys, new internal Stripe IDs), currency column flip, pricing_copy edits, FAQ row, SDK alias exports.

---

## Out of scope
- Multi-currency support (USD + CAD side-by-side). CAD-only for now per spec.
- Frontend pricing page (Claude's pass).
- Anything in `src/pages/**` or `src/components/**`.

## Risk notes
- Archiving Stripe prices is reversible (un-archive), but anyone mid-checkout in a stale session would fail. Safe in sandbox.
- If you've already shared the USD checkout link anywhere, those links break. Confirm none are live.
