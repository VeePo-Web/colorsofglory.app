## Migration #8 — Founder-Rate Pro, Storage Add-ons, Founder-Code-Gated Checkout

Backend-only. No frontend. Implements the Growth System doc's pricing architecture on top of what Migration #7 already shipped.

### Pricing being implemented (from Growth System doc)

| Product | Price ID | Amount | Notes |
|---|---|---|---|
| Pro (public) | `cog_pro_monthly` | $100/mo | Already created ✅ |
| **Founder Rate Pro** | `cog_founder_pro_monthly` | **$50/mo** | New. Gated server-side by founder-code attribution. |
| Storage +25 GB | `cog_storage_25gb_monthly` | $10/mo | New. Stackable add-on. |
| Storage +100 GB | `cog_storage_100gb_monthly` | $25/mo | New. |
| Storage +500 GB | `cog_storage_500gb_monthly` | $75/mo | New. |
| Storage +1 TB | `cog_storage_1tb_monthly` | $125/mo | New. |

All products: `tax_code = txcd_10103001` (SaaS), `managed_payments` on every checkout (full compliance handling, your choice).

### Why a separate Founder-Rate product instead of a Stripe promotion code

The Growth System doc treats the founder rate as "privileged access through trusted songwriters" — i.e. you only ever pay $50, not "$100 with a coupon." A second product gives:
- Clean accounting: founder revenue rolls up separately (existing `subscriptions.plan='founder_pro'` enum already exists).
- Simpler refund/chargeback math.
- Founder reward math (already in `record_invoice_paid`: $20/mo first 6 months, $10/mo after) keyed off `plan='founder_pro'` works without changes.
- Avoids `managed_payments` ↔ promotion-code edge cases.

### Founder-code gating (server-side, in `create-checkout`)

If `priceId === 'cog_founder_pro_monthly'`:
1. Verify the user has an active `referral_attributions` row with `referrer_type='founder'` (already populated by `referral-attach` edge function when they redeemed a founder code at signup).
2. If not, return `403 founder_code_required` — the frontend can prompt for the code, call `referral-attach`, then retry checkout.
3. If yes, proceed with checkout at $50/mo.

This means founder codes are redeemed **once** at signup (existing flow), and that attribution permanently unlocks the founder-rate product for that user. Codes themselves remain single-use via existing `redeem_code()` RPC.

### Storage add-ons — schema

New table `public.storage_addons`:
- `id`, `user_id`, `external_id` (Stripe sub id, unique), `lookup_key` (e.g. `cog_storage_100gb_monthly`), `bytes_granted bigint`, `status text` (active/canceled/past_due), `current_period_end`, timestamps.
- RLS: user reads own; service_role full; admin reads all.
- GRANTs: `authenticated` SELECT, `service_role` ALL.

`effective_storage_limit(user_id)` rewritten:
```
free_base_mb  (app_settings) -- 200MB today
+ pro_base_gb (app_settings, new) -- 100GB per Growth doc
  if current_plan(user) IN ('pro','founder_pro')
+ SUM(bytes_granted) FROM active storage_addons
```

Add new `app_settings` rows: `pro_storage_gb = 100`.

### `payments-webhook` changes

Add lookup-key routing:
- `cog_pro_monthly` / `cog_founder_pro_monthly` → existing `upsertSubscription` path (plan from `planForLookupKey`).
- `cog_storage_*` → new `upsertStorageAddon` path:
  - Upsert `storage_addons` row; map lookup_key → bytes (25/100/500/1024 GB).
  - **Do NOT** call `record_invoice_paid` (storage add-ons excluded from referral rewards per launch rule).
- `invoice.paid` continues to call `record_invoice_paid` only when the invoice's subscription resolves to a row in `subscriptions` (not `storage_addons`). Already true since lookup happens via `subscriptions.external_id`.

### `_shared/stripe.ts` changes

Extend `planForLookupKey()` and add `bytesForStorageLookupKey()`:
```
cog_pro_*           → pro
cog_founder_pro_*   → founder_pro
cog_storage_25gb_*  → 25  * 1024^3 bytes
cog_storage_100gb_* → 100 * 1024^3
cog_storage_500gb_* → 500 * 1024^3
cog_storage_1tb_*   → 1024 * 1024^3
```

### SDK additions (`src/integrations/cog/billing.ts`)

- Extend `PRICE_IDS` with founder + 4 storage SKUs.
- Add `getStorageAddons(userId)` and `getEffectiveStorageLimit(userId)` (RPC).
- Add `canPurchaseFounderRate(userId)` helper (checks attribution exists).

### Order of operations

1. **`payments--batch_create_product`** — create the 5 new products/prices in Stripe sandbox.
2. **Migration #8** — `storage_addons` table + GRANTs + RLS, rewrite `effective_storage_limit`, seed `pro_storage_gb` app setting.
3. **Edit `_shared/stripe.ts`** — add helpers.
4. **Edit `create-checkout/index.ts`** — add founder-rate gating.
5. **Edit `payments-webhook/index.ts`** — add storage-addon upsert branch.
6. **Edit `src/integrations/cog/billing.ts`** — expose new IDs + helpers.
7. **Update `.lovable/plan.md`**.

### Deliberately NOT in this step

- Founder code creation UI (already exists via `admin-founders` edge function from Migration #6).
- Annual Pro option — Growth System doc doesn't define one; the North Star $500/yr conflicts and is older.
- Future Team/Church $199+ plan — explicitly "later" in both docs.
- Frontend pricing page, checkout component, storage-meter UI — Claude's domain.
- Storage overage soft warnings (80%/95%/100%) — frontend concern.
- Lead-magnet "First Song Free" funnel — frontend/marketing, already covered by existing free-tier enforcement.

---

## ✅ Migration #8 SHIPPED (2026-06-03)

- Stripe products created: `cog_founder_pro_monthly` ($50/mo), `cog_storage_25gb_monthly` ($10), `cog_storage_100gb_monthly` ($25), `cog_storage_500gb_monthly` ($75), `cog_storage_1tb_monthly` ($125). All tax_code `txcd_10103001`.
- New table `public.storage_addons` (user_id, external_id, lookup_key, bytes_granted, status, period dates). RLS: user reads own, admin reads all.
- `effective_storage_limit(user_id)` rewritten: base = 200 MB free / 100 GB pro (new `pro_storage_gb` app_setting) + SUM of active storage_addons.bytes_granted.
- `_shared/stripe.ts`: added `isStorageLookupKey()` + `bytesForStorageLookupKey()`; corrected `defaultUnitAmountForPlan('founder_pro')` to 5000¢; storage keys map to plan='free'.
- `create-checkout`: founder-rate priceId returns `403 founder_code_required` unless user has `referral_attributions` row with `referrer_type='founder'`.
- `payments-webhook`: subscription events with storage lookup_keys route to `upsertStorageAddon()` (separate table). `invoice.paid` for storage-addon subs returns early — no referral reward.
- SDK `src/integrations/cog/billing.ts`: added 5 new `PRICE_IDS`, `getStorageAddons()`, `getEffectiveStorageLimit()`, `canPurchaseFounderRate()`.

