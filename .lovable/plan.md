## Goal
Add a special promo code `JAM100` that gives 100% off the Pro plan at checkout (free forever, or free first cycle depending on Stripe coupon config).

## Approach
Handle this server-side in the existing `validate-code` edge function (the same seam that already handles founder codes and member referrals). This keeps the client honest — the UI can display the discount, but the actual pricing decision lives on the server where `create-checkout` reads it.

### 1. Edge function: `supabase/functions/validate-code/index.ts`
- Add a hard-coded branch checked BEFORE founder/member lookups:
  - If `code === "JAM100"` and `planKey === "pro"` and the user has no existing `referral_attributions` row, return:
    ```json
    {
      "kind": "promo_full",
      "discount_pct": 100,
      "effective_cents": 0,
      "promo_label": "JAM100 — 100% off Pro"
    }
    ```
  - Preserve existing self/already-attributed guards.

### 2. Edge function: `supabase/functions/create-checkout/index.ts` (needs read)
- Teach it to recognize `kind: "promo_full"` from validate-code (or re-validate the code itself for safety) and either:
  - Attach a pre-created Stripe 100% off coupon/promotion code to the checkout session, OR
  - For `effective_cents === 0`, skip Stripe entirely and directly grant the Pro entitlement (insert into `subscriptions` / `billing_events`) then redirect to the success page.
- Recommended: use a Stripe **100% off forever coupon** attached via `discounts: [{ coupon: "JAM100_COUPON_ID" }]` so Stripe still records the subscription (needed for later portal/cancel flows). The coupon ID would be stored as a secret (`STRIPE_JAM100_COUPON_ID`) or hard-coded.

### 3. UI (already wired)
The existing pricing/upgrade flow that calls `validate-code` and shows the discounted price will automatically render "$0.00 / month — JAM100 applied" once the server returns `effective_cents: 0`. No component changes needed beyond confirming the label displays.

## Open questions before I build
1. **Duration of the 100% off**: forever (lifetime free Pro), first month only, or first year? This changes whether we create a `duration: "forever"` vs `"once"` vs `"repeating"` Stripe coupon.
2. **Usage cap**: unlimited redemptions, or single-use / capped (e.g. first 100 users)?
3. **Do you already have a Stripe coupon created** for this, or should the edge function create/lookup one automatically on first use?

Once you answer these, I'll wire it end-to-end.
