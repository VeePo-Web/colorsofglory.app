## Stripe Payments — products, checkout, webhook (DONE)

Backend-only setup to activate Lovable's built-in (seamless) Stripe integration and connect it to the existing `billing-webhook` edge function from Migration #6.

### What shipped

- Seamless Stripe enabled (sandbox + auto-registered webhook at `/functions/v1/payments-webhook?env=sandbox|live`).
- Product: **Colors of Glory Pro** (`cog_pro`), price `cog_pro_monthly` = $100/mo USD, tax_code `txcd_10103001` (SaaS), full compliance handling (`managed_payments: { enabled: true }`).
- Edge functions:
  - `create-checkout` — auth-required, resolves a Stripe Customer by `metadata.userId`, returns embedded `clientSecret`.
  - `payments-webhook` — verifies signature, idempotent via `billing_events.external_event_id`, dispatches:
    - `checkout.session.completed` (subscription mode) → fetch sub, upsert row with `plan='pro'`.
    - `customer.subscription.{created,updated,deleted}` → upsert `subscriptions` row (plan + status + period).
    - `invoice.paid` / `invoice.payment_succeeded` → `record_invoice_paid` (fires referral reward).
    - `charge.refunded` → `record_invoice_refunded`.
    - `charge.dispute.created` → `record_chargeback`.
- DB helpers: `current_plan(uuid) → sub_plan`, `is_pro_user(uuid) → boolean`. Pro access includes canceled subscriptions until `current_period_end` (grace period).
- SDK: `src/integrations/cog/billing.ts` exposes `getCurrentPlan`, `isProUser`, `getLatestSubscription`, `createCheckoutSession`, and `PRICE_IDS`.
- Old BYOK `billing-webhook` function deleted; `config.toml` updated.

### Business logic baked in

- **Purchase / active subscription** → `subscriptions.plan='pro'`, status from Stripe. Use `is_pro_user()` server-side to lift free-tier caps in `create-song` / storage triggers.
- **Cancel** (`cancel_at_period_end=true` or status `canceled` with future `current_period_end`) → Pro access continues until period end, then `current_plan` flips back to `free`.
- **Downgrade / upgrade** → handled automatically on `customer.subscription.updated` via `lookup_key` → plan mapping (`planForLookupKey`).
- **Refund / chargeback** → existing RPCs claw back referral rewards.
- **Free-tier enforcement on downgrade** → no destructive action. Existing songs stay editable; `create-song` blocks new ones past the free cap (unchanged behavior).

### TODO (not in this step)

- Founder Pro product + Founder discount codes (`stripe_promotion_code_id` backfill on `codes`) — waiting on uploaded pricing doc.
- `create-portal-session` edge function for self-service cancel / payment-method updates.
- Frontend pricing page, paywall, checkout component — Claude's domain.
