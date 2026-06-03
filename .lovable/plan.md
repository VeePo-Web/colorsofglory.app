## Scope

Confirm that the 6 CAD lookup keys exported by the app SDK round-trip cleanly through Stripe → `payments-webhook` → the right DB fields. This is a verification pass — no code changes are planned. If a mapping bug surfaces, I'll patch the helper or webhook handler in a follow-up.

## What I already audited (no edits)

Mapping chain, end-to-end:

```
src/integrations/cog/billing.ts          supabase/functions/_shared/stripe.ts        payments-webhook → DB
─────────────────────────────────        ────────────────────────────────────         ────────────────────
PRICE_IDS.pro_monthly                    planForLookupKey  "cog_pro*"   → pro         subscriptions.plan='pro',
  = "cog_pro_monthly_cad"                defaultUnitAmount pro          → 10000         unit_amount_cents=10000,
                                                                                        currency='cad'

PRICE_IDS.founder_pro_monthly            planForLookupKey  "cog_founder*"→founder_pro subscriptions.plan='founder_pro',
  = "cog_founder_pro_monthly_cad"        defaultUnitAmount founder_pro  → 5000          unit_amount_cents=5000,
                                                                                        currency='cad'

PRICE_IDS.storage_25gb_monthly           isStorageLookupKey  → true                   storage_addons.bytes_granted
  = "cog_storage_25gb_monthly_cad"       bytesForStorageLookupKey "cog_storage_25gb*"  = 25 GiB, currency 'cad'
                                          → 25 * GiB
(same shape for 100gb / 500gb / 1tb)
```

Founder gating in `create-checkout` accepts both legacy and `_cad` IDs:
`priceId === "cog_founder_pro_monthly" || priceId === "cog_founder_pro_monthly_cad"`.

Webhook currency defaults are `'cad'` in `upsertSubscription`, `handleInvoicePaid`. Prefix-based helpers (`startsWith("cog_pro")`, `"cog_founder"`, `"cog_storage_*"`) all still match the `_cad`-suffixed keys, so no helper changes are required.

## Verification steps (read-only / synthetic)

For each of the 6 CAD lookup keys, post a signed synthetic Stripe webhook to `payments-webhook?env=sandbox` and assert the exact DB row written. Re-uses the same synthetic `USER_ID` and webhook-signing harness from the prior CAD verification run.

1. `cog_pro_monthly_cad` → `customer.subscription.created`
   - assert `subscriptions`: `plan='pro'`, `currency='cad'`, `unit_amount_cents=10000`, `status='active'`, period start/end set.
2. `cog_founder_pro_monthly_cad` → `customer.subscription.created`
   - assert `subscriptions`: `plan='founder_pro'`, `currency='cad'`, `unit_amount_cents=5000`.
3. `cog_storage_25gb_monthly_cad` → `customer.subscription.created`
   - assert `storage_addons`: `bytes_granted = 25 * 2^30`, `lookup_key='cog_storage_25gb_monthly_cad'`, `status='active'`.
4. `cog_storage_100gb_monthly_cad` → assert `bytes_granted = 100 * 2^30`.
5. `cog_storage_500gb_monthly_cad` → assert `bytes_granted = 500 * 2^30`.
6. `cog_storage_1tb_monthly_cad` → assert `bytes_granted = 1024 * 2^30`.
7. Run `current_plan(USER_ID)` and `effective_storage_limit(USER_ID)` — confirm `founder_pro` and base+addons math.
8. Cleanup: delete the synthetic `billing_events`, `subscriptions`, `storage_addons` rows.

## What I will NOT do here

- No edits to `src/pages/**` or `src/components/**` (Claude owns).
- No live `4242` end-to-end run — still blocked on Claude shipping the embedded checkout host route. Once that route exists, the SDK→checkout→webhook path is exercised automatically by clicking each PRICE_IDS entry.
- No new migrations. Cleanup uses the existing `service_role` delete path.

## Expected outcome

If all 6 synthetic webhooks land with `processing_error=null`, `currency='cad'`, and the asserted field values, the mapping is verified for the backend half. I'll report PASS per product and flag the UI-side as still pending Claude.
