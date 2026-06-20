# L9 — LOVABLE: Storage Quotas + Plan Gating + Stripe
## Cluster 10 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. The business model, enforced **server-side** and kindly. Backend +
> the `cog/*` seam only. Songwriter truth: *the first song is free and magical; paying is
> a calm, obvious yes — never a trap.*

## YOUR ROLE
Lovable: Supabase schema/RLS, edge functions, Stripe, the typed `cog/billing.ts` +
`cog/storage.ts` seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Present: tables `plan_tiers`, `subscriptions`, `billing_events`, `storage_usage`,
`storage_addons`, `pricing_copy`, `founders`, `founder_codes`, `codes`; seam `billing.ts`,
`storage.ts`, `founders.ts`; edge functions `billing-cancel-subscription`,
`billing-customer-portal`, `apply-founder-code-to-active-sub`. Locked product decisions
(`CLAUDE.md` §11): **free tier = exactly one song; the second song triggers upgrade.**
Specs: Vision 13 (Storage Protects Creative Work), the payment-plan docs in
`zip_extracted/…/0.1 Songwriting full payment plan and structure/`.

## OBJECTIVE
Reliable, server-enforced plan gating + storage quotas + Stripe subscriptions, with
founder codes — all exposed through a clean seam, none of it bypassable from the client.

## TASKS
1. **Plan gating (server-side, Critical):** enforce free = 1 song at the **database/edge**
   level (creating a 2nd song on free is denied server-side, surfaced as an upgrade
   signal — the UI must not be the only gate). Plan tiers + entitlements from `plan_tiers`.
2. **Storage quotas:** account audio/storage per user (`storage_usage`) toward the plan
   quota; enforce on upload; `storage_addons` extend it. Expose remaining quota.
3. **Stripe subscriptions:** checkout session creation, subscription lifecycle, and
   **webhooks** → `billing_events` (source of truth for entitlement). Idempotent webhook
   handling; reconcile subscription state.
4. **Customer portal + cancel:** wire `billing-customer-portal` + `billing-cancel-…`;
   downgrade behavior preserves data (never delete a song on downgrade — lock/limit).
5. **Founder codes:** `apply-founder-code-to-active-sub` + `founder_codes`/`codes` — grant
   entitlements; prevent reuse/fraud (coordinate with existing fraud_flags).
6. **Seam:** `cog/billing.ts` (plan, entitlements, checkout, portal, apply-code) +
   `cog/storage.ts` (usage, quota, remaining). Document states/errors for C9/C10.

## DELIVERABLES
1. Server-side plan gating (free=1 song) + entitlements. 2. Storage accounting + quota
   enforcement + add-ons. 3. Stripe checkout + lifecycle + idempotent webhooks →
   billing_events. 4. Customer portal/cancel with data-preserving downgrade. 5. Founder
   codes + anti-reuse. 6. Documented billing + storage seam.

## ACCEPTANCE CRITERIA
- [ ] A free user cannot create a 2nd song — denied server-side (not just UI), with a clear upgrade signal.
- [ ] Storage quota enforced on upload; remaining quota exposed; add-ons work.
- [ ] Stripe checkout + webhooks drive entitlement via billing_events; idempotent.
- [ ] Downgrade/cancel never deletes songs; portal works; founder codes grant + can't be reused.
- [ ] One typed seam covers billing + storage for the UI.

## CONSTRAINTS
Backend + seam only. Entitlement is server truth — never trust the client. Stripe keys +
webhooks server-side only. No dark patterns in gating logic. `lovable/billing-storage` → merge → delete.

## REFERENCES
- tables: `plan_tiers`, `subscriptions`, `billing_events`, `storage_usage`, `storage_addons`, `pricing_copy`, `founder_codes`, `codes`
- `src/integrations/cog/billing.ts`, `storage.ts`, `founders.ts`; `supabase/functions/billing-*`, `apply-founder-code-*`
- Vision 13 PDF + `zip_extracted/…/0.1 Songwriting full payment plan and structure/`
- `docs/prompts/L1-…schema-consolidation.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §11
