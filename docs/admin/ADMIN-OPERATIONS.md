# Colors of Glory — Admin Operations Runbook
### How to actually run the internal admin system: payouts, referrals, fraud, auth security, finance, deploys.
*Maintained by the Admin/Backend Claude. Companion to `ADMIN-BACKEND-PLAN.md` (architecture) and `REFERRAL-UX-AUDIT.md` (UX gaps). Last updated 2026-06-23.*

---

## 0. Access & the golden rule
- The admin console lives at **`/admin`** and is gated by `has_role(auth.uid(),'admin')` — both in the UI (`RequireAdmin`) and server-side in every RPC/edge function. Grant admin by inserting the `admin` role for a user (Lovable/DB).
- **Golden rule:** never hand-edit money. Every balance/reward/payout transition goes through a guarded RPC that writes an audit row. If you're tempted to `UPDATE` a row directly, stop — there's a button/RPC for it.

## 1. The console at a glance
| Page | Use it to… |
|---|---|
| **Home** | Triage: open fraud flags, referrers blocked on payout, stuck webhooks, draft payouts — each links to its page. Start here daily. |
| **Founders** | See all founders; open one to manage lifecycle + see code performance. |
| **Founder detail** | Pause / resume / revoke a founder; edit their reward profile; per-code referred/payable. |
| **Codes** | Founder codes. |
| **Referrals** | Per-referrer payments tracker — who's owed, who's **blocked (no payout method)**. |
| **Payouts** | Monthly report (read) → **Batches** for the approve/pay workflow. |
| **Finance** | MRR, active subs, churn, **reward liability**, refunds/chargebacks — reconcile to Stripe. |
| **Webhooks** | Stuck/failed Stripe events; re-drive the safe ones. |
| **Fraud** | Flag/resolve users or founders (blocks reward minting). |
| **Attribution** | Re-attribute a mis-credited referral. |
| **Auth** | OTP send volume, ceiling utilization, tune toll-fraud limits. |
| **Audit** | Search every privileged action (before→after, actor, reason). |

## 2. Monthly payout run (the core money process)
1. **Drafts are auto-created** day-1 of each month by the pg_cron job `cog-create-payout-drafts-monthly` (07:25 UTC), after maturation (`cog-mature-holds-daily`, 07:17). Drafts sweep all matured (`payable`), un-batched cash rewards.
2. Go to **/admin/payouts/batches**. Each draft = one recipient's owed amount.
3. **Approve** a draft → blocked unless the recipient has a payout method on file (`no_payout_method`). If blocked, the referrer must add one (see §3); check **/admin/referrals** for who's blocked.
4. Pay them externally (PayPal / Stripe Connect / manual transfer), then **Mark paid** and paste the **provider/transfer id** (stored for reconciliation; the reward events flip to `paid`).
5. If a payment fails, **Mark failed** (with reason), then **Retry** later (resets to draft).
6. Reconcile totals against **/admin/finance** and the Stripe dashboard.

**Never** pay `pending` (still in clawback hold) or `reversed` money — the system already excludes it from batches.

## 3. Referrals & getting people paid
- **/admin/referrals** lists every referrer with referred/paying counts, pending/payable/paid, and payout method. The amber banner flags **earned-but-unpayable** referrers — chase those for a payout method.
- A referrer can claim a **vanity code** (`claim_referral_code`) and shares via the prefilled `share_message` from `me-referrals` — the referrer-facing screen is the onboarding Claude's (`REFERRER-PAGE-HANDOFF.md`).
- Rewards mint on a referee's paid invoice, hold ~30 days (clawback), mature to `payable`, then get batched. This is intentional fraud protection — see the "new since last seen" badge data for instant acknowledgment.

## 4. Fraud handling
- **/admin/fraud**: flag a `user` or `founder` (with reason + severity). An **open flag blocks all reward minting** for that subject (`record_invoice_paid` checks it). Resolve when cleared.
- Self-referrals are already blocked at the DB level. Use flags for shared-card / velocity / collusion cases.
- Watch **Home** for the open-flag count.

## 5. Auth security (phone OTP toll-fraud)
- **/admin/auth**: 24h/1h send volume, distinct phones/IPs, **daily-ceiling utilization gauge** (the bill circuit breaker), top phones. Tune the geo allowlist + per-phone/IP/global limits inline (takes effect immediately via `otp-guard`).
- **If utilization spikes toward the ceiling:** if it's real growth, raise the ceiling; if not, you're likely being pumped — tighten limits / narrow the geo allowlist.
- **Dashboard floor (do once, outside this app):** enable Supabase Auth **CAPTCHA**, set **Allowed Countries** to match the allowlist, set the provider SMS rate limit, register **A2P 10DLC**, and set a Twilio billing alert. The in-app guard is defense-in-depth; CAPTCHA is the bypass-proof layer. (See `ADMIN-BACKEND-PLAN.md` §8.)

## 6. Webhook ops
- **/admin/webhooks**: lists `billing_events`, highlighting stuck ones (`processing_error` or unprocessed).
- **Re-drive** works for `invoice_paid` / `invoice_refunded` / `chargeback_created` (re-runs the idempotent money RPCs). Subscription/plan events must be **re-sent from the Stripe dashboard** (they need a live re-fetch).

## 7. Finance reconciliation
- **/admin/finance** computes everything from the Stripe-sourced tables. Monthly: confirm MRR + active subs match Stripe; watch **reward liability** (real money owed) and refunds/chargebacks. Investigate any drift as a P1 — don't paper over it.

## 8. Investigations
- **/admin/audit**: filter by action / entity / invoice; expand before→after + actor + reason. Every approve/pay/retry/reversal/fraud/attribution/setting change is here.

## 9. Deploy procedure
After any migration/edge-function change lands on `main`:
```bash
supabase db push                              # applies new migrations (RPCs, cron, columns)
supabase functions deploy me-referrals        # if referral data changed
supabase functions deploy otp-guard           # if OTP guard changed
supabase functions deploy admin-payouts admin-redrive-billing-event  # if changed
supabase secrets set OTP_IP_SALT=$(openssl rand -hex 16)   # once, recommended
```
Cron is created by migration; verify: `select jobname, schedule from cron.job where jobname like 'cog-%';`

## 10. Scheduled jobs (pg_cron)
- `cog-mature-holds-daily` (07:17 UTC) — promotes matured rewards `pending→payable`, reverses churned/refunded.
- `cog-create-payout-drafts-monthly` (day-1 07:25 UTC) — drafts payouts for all matured, un-batched cash.
- `cog-expire-invites-hourly` — invite cleanup.

## 11. Boundaries & what's intentionally NOT here
- **Onboarding / login / OTP screens, referrer-facing share page** → the onboarding Claude (`REFERRER-PAGE-HANDOFF.md`). Backend for all of it is ready.
- **Pending (gated):** **dunning** — a grace period for `invoice.payment_failed`. Not built because it edits the live payments webhook and needs Stripe-sandbox testing first. Greenlight + sandbox plan required before it ships.
- **Schema co-owned with Lovable** — coordinate migrations.
