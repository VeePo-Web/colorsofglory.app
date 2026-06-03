## Enable Lovable Stripe Payments + wire webhook secret

Backend-only setup to activate Lovable's built-in (seamless) Stripe integration and connect it to the existing `billing-webhook` edge function from Migration #6.

### Steps

1. **Run eligibility check** (`recommend_payment_provider`) to confirm Stripe is the right fit for Colors of Glory (digital SaaS / songwriting collaboration — Paddle may also be recommended, but you asked specifically for Stripe).

2. **Enable seamless Stripe** via `enable_stripe_payments`. This:
   - Creates a Lovable-managed Stripe account (test mode immediately, live after verification).
   - Provisions `STRIPE_SECRET_KEY` automatically — no key paste needed.
   - No code changes in this step.

3. **Add `STRIPE_WEBHOOK_SECRET`** via the secrets tool, scoped to the `billing-webhook` edge function. After Stripe is enabled, Lovable surfaces the webhook signing secret from the managed Stripe account; you paste it into the secret form.

4. **Verify `billing-webhook` activates**:
   - The function currently returns 503 when `STRIPE_WEBHOOK_SECRET` is missing.
   - Once set, it will verify Stripe signatures and dispatch events to `record_invoice_paid`, `record_invoice_refunded`, `record_chargeback` (already deployed in Migration #6).
   - No code changes required to the function — the secret check is already in place.

5. **Confirm `verify_jwt = false`** for `billing-webhook` in `supabase/config.toml` (already set in Migration #6) so Stripe can POST without a user JWT.

### Deliberately NOT in this step

- Creating Stripe products/prices (Pro plan, Founder Pro plan) — separate step once you confirm pricing tiers.
- Stripe Tax / managed_payments configuration choice — separate decision.
- Checkout session edge function (`create-checkout`) and customer portal — separate step.
- Frontend pricing page / paywall UI — Claude's domain.
- `stripe_promotion_code_id` backfill on the `codes` table (founder/referral discount codes) — happens after products exist.

### Technical notes

- The seamless integration and the BYOK `enable_stripe` integration are mutually exclusive. We use seamless.
- Webhook endpoint URL Stripe will hit: `https://vsiecltcxsuuulbczexl.supabase.co/functions/v1/billing-webhook`.
- Idempotency is already enforced via `billing_events.external_event_id` unique constraint.
