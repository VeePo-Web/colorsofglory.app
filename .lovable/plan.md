## Payments v2 Audit — gaps found and the fix plan

I traced the spec against `plan_tiers`, `create-checkout`, `validate-code`, `payments-webhook`, `_shared/stripe.ts`, `redeem-founder-code`, `referral-attach`, and `config.toml`. The architecture is sound, but there are 10 concrete gaps — some of which will break checkout outright on the current Stripe API version. Fixing them is mostly small, surgical edits plus one Stripe action and one new endpoint.

---

### Critical (will break checkout or webhooks today)

1. **Stripe products were never actually created.** The prior summary proposed `payments--batch_create_product` for `cog_starter` / `cog_pro` / `cog_pro_referral` but the tool call was never executed. `create-checkout` will hit `price_not_found` on `stripe.prices.list({ lookup_keys: ['starter_monthly'] })`. → Run `payments--batch_create_product` for all three with `tax_code: 'txcd_10103001'`, quantity 1/1, monthly recurring.

2. **`invoice.subscription` is gone on API version `2026-03-25.dahlia`.** `payments-webhook` reads `invoice.subscription` in `handleInvoicePaid`, which is `null` on the pinned API version. Result: every renewal silently no-ops, founder payouts and $5 member-referral payouts never mint past month 1. → Read `invoice.parent.subscription_details.subscription` first, then fall back to `invoice.subscription` and to `invoice.lines.data[0].subscription` (legacy + safety net).

3. **`verify_jwt = false` missing in `supabase/config.toml`** for `create-checkout`, `validate-code`, and `redeem-founder-code`. Stripe knowledge says this is mandatory for any payment edge function — CORS preflight blows up with 401-no-CORS otherwise. Only `payments-webhook` is currently flagged. → Add three function blocks to `supabase/config.toml`.

4. **Founder code `redemption_count` never increments.** `create-checkout` matches and routes to the $49 price but does not `update codes set redemption_count = redemption_count + 1`. `max_redemptions` caps are therefore never enforced after the first sale. → On successful Stripe session create, increment `codes.redemption_count` when `appliedCodeKind = 'founder'`.

### High (spec violations, not crashes)

5. **Legacy attribution paths bypass the "one code per buyer" rule.** `referral-attach` and `redeem-founder-code` both call `attribute_referral` / `redeem_founder_code` RPCs that insert into `referral_attributions` *before* checkout. A user who lands on `/invite/:token` gets an attribution row written, then `create-checkout` rejects every subsequent code with `already_attributed`. → Either retire both functions (preferred — checkout now owns attribution writes) or change them to be advisory-only (store pending code on `profiles.pending_code`, do not insert into `referral_attributions`). I'll retire `referral-attach` and reshape `redeem-founder-code` to just stash the code on the session for the checkout flow.

6. **Legacy `founder_code_required` gate in `create-checkout` uses dead price IDs.** Lines that check `priceId === 'cog_founder_pro_monthly'` are from v1 and never match v2 lookup keys, so the gate is dead code. With the new flow, gating happens via `stripe_referral_price_id` routing on the founder match path. → Delete the legacy block.

7. **Already-Pro user applying a founder code is unimplemented** (spec §6). Need a small endpoint `apply-founder-code-to-active-sub`: validates the code, swaps the subscription item to `pro_monthly_referral_50` via `stripe.subscriptions.update({ items: [{ id, price: 'pro_monthly_referral_50' }], proration_behavior: 'create_prorations' })`, writes the attribution row, increments redemption_count. Webhooks then pay the founder from the next `invoice.paid`.

8. **Storage-addon purchase server-side gate.** Spec requires "block on non-Pro." Need to confirm the addon-purchase edge function reads `plan_tiers.allows_storage_addons` for the buyer's current plan and 403s otherwise. → Audit `storage-addon-*` function (or add the guard if missing).

### Medium (correctness and clarity)

9. **`plan_for_lookup_key` falls through to `'free'` on unknown keys.** A typo or new add-on would silently downgrade a paying user. → Throw / log loudly on unknown lookup keys for non-storage SKUs.

10. **`pricing_copy` micro-section copy + FAQ payload not seeded.** `getPricingPage()` returns `page`, `cards`, but the spec also asks for founder-code micro-section, referral micro-section, and comparison caption. Verify those keys are present in `pricing_copy` rows; seed any missing ones with the exact Ogilvy copy from the brief.

---

### Build sequence

```text
1.  Create Stripe products (cog_starter, cog_pro, cog_pro_referral)
    via payments--batch_create_product, tax_code txcd_10103001.
2.  Patch config.toml: add verify_jwt=false for create-checkout,
    validate-code, redeem-founder-code.
3.  Migration:
      - Drop legacy founder_code_required block in create-checkout
        (code change, not SQL).
      - Add increment_founder_redemption(_code_id uuid) SECURITY DEFINER
        helper for create-checkout to call.
      - Loud-fail planForLookupKey on unknown non-storage keys.
4.  Patch payments-webhook handleInvoicePaid:
      sub = invoice.parent?.subscription_details?.subscription
         ?? invoice.subscription
         ?? invoice.lines?.data?.[0]?.subscription
5.  Patch create-checkout: call increment_founder_redemption after
    stripe.checkout.sessions.create succeeds with founder routing.
6.  Retire referral-attach (delete edge function + remove SDK callers
    that still hit it). Reshape redeem-founder-code to stash code on
    profiles.pending_founder_code (new column) instead of writing
    referral_attributions. Checkout reads pending_founder_code as a
    fallback for `code`.
7.  New edge function apply-founder-code-to-active-sub for the
    already-Pro path (spec §6).
8.  Audit storage-addon purchase function; add plan_tiers.allows_storage_addons
    gate if missing.
9.  Seed any missing pricing_copy rows (founder micro, referral micro,
    comparison caption, FAQ array).
10. Smoke test via supabase--curl_edge_functions:
      - validate-code for valid founder, valid member, self, expired,
        already_attributed
      - create-checkout for starter, pro no code, pro+founder,
        pro+referrer, pro+both (founder wins)
      - simulate invoice.paid webhook with parent.subscription_details
        shape → confirm reward_events row written.
11. Update .lovable/payments-v2.md with the fixes and the new endpoint.
```

### Non-goals (out of scope for this pass)

- Frontend pricing page — that's Claude Code's pass per the original handoff.
- Currency expansion — stays USD.
- Auth hardening — HIBP / email verification untouched.

Confirm and I'll execute steps 1–11 end-to-end.
