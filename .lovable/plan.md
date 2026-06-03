## Switch billing to CAD

Colors of Glory is a Canadian company, so all Stripe products, prices, and code defaults should be in CAD instead of USD.

### What changes

**1. Stripe products / prices (test env, auto-synced to live on publish)**

Create CAD-denominated prices on the existing products and update code to reference the new CAD price IDs. Stripe prices are immutable — you can't change currency on an existing price, so we add new ones and switch the app to use them.

New CAD prices (same amounts, just CAD):
- `cog_pro_monthly_cad` — $100 CAD/mo on `cog_pro`
- `cog_founder_pro_monthly_cad` — $50 CAD/mo on `cog_founder_pro`
- `cog_storage_25gb_monthly_cad` — $10 CAD/mo
- `cog_storage_100gb_monthly_cad` — $25 CAD/mo
- `cog_storage_500gb_monthly_cad` — $75 CAD/mo
- `cog_storage_1tb_monthly_cad` — $125 CAD/mo

Old USD prices stay in Stripe (any existing test subscriptions keep working) but the app stops referencing them.

**2. Edge function code**

- `supabase/functions/_shared/stripe.ts` — change `defaultUnitAmountForPlan` currency from `usd` to `cad`; update `planForLookupKey` / `bytesForStorageLookupKey` / `isStorageLookupKey` to recognize the new `_cad` lookup keys alongside (or instead of) the existing ones.
- `supabase/functions/create-checkout/index.ts` — default currency `cad`; map plan → new CAD price IDs.
- `supabase/functions/payments-webhook/index.ts` — `upsertStorageAddon` and subscription routing keyed on the new `_cad` lookup keys.

**3. SDK**

- `src/integrations/cog/billing.ts` — `PRICE_IDS` constants point at the new `_cad` IDs.

**4. Compliance handling**

Already configured with `managed_payments: { enabled: true }` and `txcd_10103001`. CAD is fully supported for a Canadian seller — no further changes.

### What does NOT change

- Tax codes, RLS, schema, founder-code gating, storage_addons table, referral logic — all currency-agnostic.
- No frontend pricing page exists yet (Claude's scope), so no UI copy to update here.
- Old USD price IDs are left in Stripe for safety; they're just unreferenced.

### Build sequence

1. `payments--batch_create_product`–style call: add 6 new CAD prices to the existing 6 products.
2. Patch the 3 edge functions + shared stripe util + SDK constants to use the `_cad` lookup keys and `cad` currency default.
3. No DB migration required.
