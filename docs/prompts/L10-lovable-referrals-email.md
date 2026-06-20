# L10 — LOVABLE: Referrals + Email Automations
## Cluster 10 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. The growth loop where **collaboration itself drives acquisition** —
> and the few emails the app sends. Backend + the `cog/*` seam only. Calm, never spammy.

## YOUR ROLE
Lovable: Supabase schema/RLS, edge functions, email provider, the `cog/referrals.ts`
seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Present: tables `referral_attributions`, `reward_events`, `codes`, `founders`,
`founder_redemptions`, `payouts`, `fraud_flags`; seam `referrals.ts`, `founders.ts`;
admin payout functions. Specs: Vision 14 (Referral Growth Through Collaboration), Vision
15 (Product Flywheel), the lead-magnet/funnel docs in `0.1 …payment plan…`. The core
insight: **every invite (L6) is an acquisition event** — referrals piggyback on the
collaboration loop, not a bolted-on referral program.

## OBJECTIVE
Accurate, fraud-resistant referral attribution + rewards, tied to the invite loop, plus
the minimal transactional emails — all server-side and exposed via a clean seam.

## TASKS
1. **Attribution:** when an invited collaborator (L6) or a referred user signs up/converts,
   record `referral_attributions` (referrer → referee, source = invite/code/link). Tie to
   the invite token where possible so collaboration = referral.
2. **Rewards:** `reward_events` for qualifying actions (e.g. referee activates / subscribes);
   define reward types (storage bonus, free month, founder perks) and grant idempotently.
3. **Fraud resistance:** self-referral / loop / abuse detection via `fraud_flags`; cap
   rewards; verify real activation before rewarding.
4. **Founder program:** `founder_codes`/`founder_redemptions`/`payouts` — code redemption,
   reward tracking, payout records (admin-gated; never client-writable).
5. **Email automations (minimal, calm):** transactional only — invite email, password
   reset (L2), "you've been credited," reward earned. Provider (Resend/etc.) via edge
   function; no marketing spam; respect a faith-community tone + unsubscribe where applicable.
6. **Seam (`referrals.ts`):** referral status/code, attribution, rewards/balance, redeem.
   Document states for C10's referral dashboard.

## DELIVERABLES
1. Invite-tied attribution. 2. Idempotent reward grants + reward types. 3. Fraud caps +
   flags. 4. Founder code/redemption/payout (admin-gated). 5. Minimal transactional emails.
6. Documented `referrals.ts` seam.

## ACCEPTANCE CRITERIA
- [ ] Invites (L6) produce referral attribution; conversions reward the referrer idempotently.
- [ ] Self-referral/abuse is detected + capped; rewards require real activation.
- [ ] Founder codes redeem + track payouts; payout tables are admin/service-role only.
- [ ] Transactional emails send via edge function; no spam; tone is right.
- [ ] One typed `referrals.ts` seam covers the dashboard's needs.

## CONSTRAINTS
Backend + seam only. Rewards/payouts server-enforced + fraud-checked. Email keys
server-side. No spam, no dark growth patterns. `lovable/referrals-email` → merge → delete.

## REFERENCES
- tables: `referral_attributions`, `reward_events`, `codes`, `founders`, `founder_redemptions`, `payouts`, `fraud_flags`
- `src/integrations/cog/referrals.ts`, `founders.ts`; admin payout edge functions
- Vision 14/15 PDFs + `zip_extracted/…/0.1 …payment plan…/` funnel docs
- `docs/prompts/L6-…collaboration-roles-rls.md`, `L9-…storage-plans-stripe.md`, `docs/BUILD-PATHWAY.md`
