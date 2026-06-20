# C10 — CLAUDE: Business-Model Screens (Upgrade · Storage · Referral)
## Cluster 10 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. Money moments, done with grace — a faith-community app earns trust
> by never using dark patterns. Mobile-first; tokens only; seam only; meet
> `MOBILE-UX-BENCHMARK.md`. Songwriter truth: *upgrading should feel like supporting
> something I love, not being cornered.*

## YOUR ROLE
Claude: all `src/` UI. Seam only (`cog/billing.ts`, `storage.ts`, `referrals.ts`); no
schema/payments-logic/tests. `docs/BUILD-PATHWAY.md`.

## CONTEXT
Pages exist to upgrade/polish: `src/pages/pricing/UpgradePage.tsx`, `CheckoutSuccessPage`,
`ReferralRedirectPage`, `src/pages/settings/StoragePage.tsx`, `ReferralPage`, `BillingPage`.
Backed by L9 (entitlement/Stripe/storage) + L10 (referrals/rewards). Specs: Vision 13
(Storage), 14 (Referral Growth), 15 (Flywheel); onboarding 15/16/18 (Upgrade Moment,
Storage Warning, Referral Dashboard); funnel docs in `0.1 …payment plan…`.

## OBJECTIVE
Calm, honest upgrade / storage / referral screens that convert by clarity and value, with
zero dark patterns — pricing pulled from server copy, checkout via Stripe, rewards real.

## PHASE 0 — SPEC
Read Vision 13/14/15 + onboarding 15/16/18 + the funnel docs. The one moment per screen:
upgrade = *"here's what more songs unlock"*; storage = *"you're nearly full — here's the
calm fix"*; referral = *"invite a co-writer, you both benefit."*

## PHASE 4 — BUILD
1. **Upgrade screen:** value-first (what paid unlocks: more songs, storage, collaborators),
   pricing tiers from `pricing_copy` (server), annual/monthly, gold CTA → Stripe checkout
   (`cog/billing.ts`). Honest scarcity only; no fake timers; clear what happens next.
2. **Checkout success:** warm confirmation → back into creating; reflect new entitlement.
3. **Storage screen + warning:** show usage vs quota (from `cog/storage.ts`) calmly; the
   "nearly full" warning is gentle (no red panic), with add-on / upgrade paths.
4. **Referral dashboard:** the invite-as-growth loop (Vision 14) — your code/link, who you
   referred, rewards earned (from `cog/referrals.ts`); "invite a co-writer" ties to C5.
5. **Billing/manage:** current plan, manage via Stripe customer portal, cancel (data
   preserved — copy reassures nothing is deleted).
6. Mobile-first + faith-tone: 44×44, reduced-motion, tokens, calm motion; **no dark
   patterns** (no hidden cancel, no fake urgency, no guilt copy).

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: upgrade→checkout(test)→success, storage warning,
referral dashboard, manage/cancel. Evidence + a mobile re-drive.

## ACCEPTANCE CRITERIA
- [ ] Upgrade is value-first with server pricing + Stripe checkout; no fake urgency/dark patterns.
- [ ] Storage usage + gentle warning; add-on/upgrade paths clear.
- [ ] Referral dashboard shows code/referrals/rewards; ties to the invite loop.
- [ ] Manage/cancel reassures data is preserved; meets the mobile benchmark; ≤250 lines/component.
- [ ] `tsc`+`build`+tests green; 7-lens pass.

## DEPENDENCIES
- **L9** (billing/storage seam + entitlement) · **L10** (referrals seam) · **C5** (invite).
  Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/business-screens` → merge → delete.
Faith-community standard: dignity + honesty over conversion tricks, always.

## REFERENCES
- `src/pages/pricing/*`, `src/pages/settings/{StoragePage,ReferralPage,BillingPage}.tsx`
- `src/integrations/cog/billing.ts`, `storage.ts`, `referrals.ts`
- Vision 13/14/15 + onboarding 15/16/18 PDFs + `0.1 …payment plan…/`
- `docs/prompts/L9-…storage-plans-stripe.md`, `L10-…referrals-email.md`, `C5-…collaboration-ui.md`
- `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §11
