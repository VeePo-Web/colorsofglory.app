## Verification scope — what can and can't be checked

### Can't verify: pricing/checkout UI

There is no Colors of Glory pricing/checkout UI in this repo yet. `src/pages/Pricing.tsx` and all of `src/components/**` are leftover Fly4MEdia code that we agreed not to touch — Claude Code owns the new frontend, and a CoG pricing page hasn't been built yet. The only CoG client code that references prices is the SDK at `src/integrations/cog/billing.ts`, which exports the `_cad` price IDs but doesn't render anything.

So "verify products render correctly in the pricing/checkout UI" is blocked until Claude ships a pricing page that consumes `PRICE_IDS` from the SDK. Not something I can resolve from the backend side.

### Can't verify end-to-end: test payment → DB update

A real test-card checkout requires the embedded checkout component (frontend). Without that I can't drive a Stripe Checkout Session to completion in test mode — `create-checkout` returns a `client_secret`, but only the embedded `<EmbeddedCheckout>` component can complete the payment and trigger the webhook.

What I'd need from Claude Code before this is testable: a minimal checkout host route + `<StripeEmbeddedCheckout priceId={PRICE_IDS.pro_monthly} … />` so I can run `4242 4242 4242 4242` against it and watch the webhook fire.

### Can verify now (backend-only)

I'll run these checks and report results:

1. **Stripe prices exist in CAD** — call `create-checkout` with each of the 6 new `_cad` lookup keys and confirm it returns a `clientSecret` (proves Stripe resolved the lookup_key → live CAD price, and that gating logic still works). For `cog_founder_pro_monthly_cad` I'll confirm the 403 `founder_code_required` path on an unattributed user, then attach a founder code via SQL and confirm it then succeeds.
2. **Webhook → DB mapping is correct for CAD** — `POST` synthetic Stripe-shaped JSON to `payments-webhook?env=sandbox` for:
   - `customer.subscription.created` with `lookup_key: cog_pro_monthly_cad` → row appears in `subscriptions` with `plan='pro'`, `currency='cad'`, `unit_amount_cents=10000`.
   - Same for `cog_founder_pro_monthly_cad` → `plan='founder_pro'`, `currency='cad'`, `unit_amount_cents=5000`.
   - `cog_storage_100gb_monthly_cad` → row appears in `storage_addons` (not `subscriptions`), `bytes_granted = 100 GiB`.
   - `invoice.paid` for the pro sub → `record_invoice_paid` runs, reward path is reachable, no errors.
   
   (Signed webhooks: I'll either temporarily skip signature verification for the test, or sign with `PAYMENTS_SANDBOX_WEBHOOK_SECRET`. I'll use signing — cleaner.)
3. **`current_plan` / `effective_storage_limit` reflect the changes** — query both RPCs for the synthetic user after each step and confirm:
   - Pro user: `current_plan = 'pro'`, `effective_storage_limit = 100 GiB`.
   - Pro + 100 GB addon: `effective_storage_limit = 200 GiB`.
4. **Cleanup** — delete the synthetic `subscriptions` / `storage_addons` / `billing_events` rows so test data doesn't leak.

### After verification

I'll report:
- Pass/fail for each backend check above with the actual DB values observed.
- A clear "blocked on frontend" note for the UI-render and live-card portions, with the exact Claude task needed to unblock it (mount `<StripeEmbeddedCheckout>` on a route that takes a `priceId` query param, so I can test any plan without waiting for the full pricing page).

If you'd rather I skip the synthetic-webhook path and just wait for Claude to build the checkout component before verifying anything, say so and I'll hold.
