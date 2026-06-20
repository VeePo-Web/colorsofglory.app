<!-- RECONCILED TO READ-ONLY CODEX -->
> **⚠️ Codex is READ-ONLY** — see [`../CODEX-READONLY-QA-PLAN.md`](../CODEX-READONLY-QA-PLAN.md)
> (§17 Conflict Rule overrides this file). Codex does **not** write tests, CI, scripts, or
> commits. Treat the sections below as the **QA scope** for this feature; Codex delivers it
> as an **audit report** (templates §14; owner + severity per §9–§10), and the tests / CI /
> harness described are **implemented by Claude (frontend) or Lovable (backend)** when they
> build — never by Codex. The "Lane: `codex/*`" header is superseded: Codex has no branch by
> default and reports to `docs/codex-reports/` or `docs/codex-feature-audits/`.

# Q9 — CODEX: Payments, Plan-Gating & Referral QA (no live charges)
## Cluster 10 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Money is the highest-stakes correctness surface — gate it hard, with
> **zero real charges**. Codex lane only: tests, security, a11y, QA docs. No feature/UI
> changes; file bugs.

## YOUR ROLE
Codex: `src/test/*`, security/RLS, perf, a11y, `docs/codex-*`. No feature/UI/schema. Run
after Q1 (CI) + L9/L10 + C9/C10. `docs/BUILD-PATHWAY.md`.

## CONTEXT
L9 = plan gating (free=1 song) + storage quotas + Stripe; L10 = referrals/rewards/founder
codes + emails; C9/C10 = catalog/upgrade/storage/referral UI. Surfaces:
`cog/billing.ts`, `storage.ts`, `referrals.ts`, `founders.ts`, Stripe **test mode**.

## OBJECTIVE
Prove entitlement + gating + rewards are correct and server-enforced, exports/emails fire,
and **no test can ever create a live charge** — at scale, accessible.

## TASKS
1. **Plan gate (RLS-from-client, Critical):** a free user attempting to create a **2nd
   song** is denied **server-side** (not just UI). Paid user can. Test from a real client
   session against the seam.
2. **Storage quota:** upload past quota is rejected server-side; add-ons raise the limit;
   remaining quota accurate.
3. **Stripe test-mode flows:** checkout session, webhook → `billing_events` → entitlement
   (idempotent: replayed webhook doesn't double-grant); cancel/downgrade **preserves songs**
   (no deletion). Use Stripe **test keys only**; assert no live-mode path is reachable in tests.
4. **Founder codes:** redemption grants entitlement; **reuse is rejected**; fraud caps hold.
5. **Referrals:** invite→attribution→reward is idempotent; **self-referral/abuse denied**;
   rewards require real activation; payout tables are admin/service-role only (client denied).
6. **Emails:** transactional emails trigger on the right events (mock provider); no spam.
7. **a11y + CI:** upgrade/storage/referral screens accessible; wire all billing/referral
   tests into the Q1 gate with test-mode secrets.

## DELIVERABLES
1. Plan-gate RLS-from-client tests. 2. Storage-quota enforcement tests. 3. Stripe test-mode
   + idempotent-webhook + data-preserving-downgrade tests. 4. Founder-code reuse/fraud tests.
5. Referral idempotency + abuse-denial + payout-RLS tests. 6. Email-trigger tests. 7. a11y + CI.

## ACCEPTANCE CRITERIA
- [ ] Free user cannot create a 2nd song (server-denied); paid can — tested from client.
- [ ] Storage quota enforced; webhooks idempotent; cancel/downgrade never deletes songs.
- [ ] Founder codes can't be reused; referrals can't be self-dealt; payouts admin-only.
- [ ] No test path can produce a live charge (test-mode asserted).
- [ ] Money/referral UI accessible; all tests green in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file bugs. **Stripe test mode only — never live
keys/charges.** Secrets in CI env. `codex/payments-qa` → merge → delete. A gating/charge
bug is release-blocking.

## REFERENCES
- `src/integrations/cog/billing.ts`, `storage.ts`, `referrals.ts`, `founders.ts`; `supabase/functions/billing-*`, `apply-founder-code-*`
- `docs/prompts/L9-…storage-plans-stripe.md`, `L10-…referrals-email.md`, `C9-…catalog-navigation.md`, `C10-…business-screens.md`, `Q1-…ci-quality-gate.md`
- `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §11
