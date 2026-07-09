# ADMIN CONSOLE CONTRACT (G3)

**Status:** Launch-ready · hardened + verified 2026-07-08
**Owner:** G3 Admin Console Agent. The console is internal-only first-party tooling: it renders only `/admin/*`, is `noindex,nofollow`, and is never linked from any end-user surface.

---

## 1. Console map (13 pages, all behind `RequireAdmin`)

Mounted by `src/routes/AdminRoutes.tsx` (rendered inside `App.tsx`'s `<Routes>`; every route wrapped in `RequireAdmin`):

| Route | Page | Purpose |
|---|---|---|
| `/admin` | AdminHomePage | Needs-attention cockpit (fraud flags, blocked payouts, stuck webhooks, drafts) + totals + recent referrals |
| `/admin/founders` | FoundersPage | Founder roster; search by name/slug/code/referred-user-id |
| `/admin/founders/:id` | FounderDetailPage | Codes, attributed users, reward events, by-code drilldown; pause/resume/revoke + reward-profile edit |
| `/admin/codes` | CodesPage | All founder codes; issue (CreateCodeDialog), copy share link, deactivate (confirmed) |
| `/admin/payouts` | PayoutsPage | Monthly payable/pending report per founder + CSV export |
| `/admin/payouts/batches` | PayoutBatchesPage | **The money console** — payout state machine actions |
| `/admin/finance` | FinancePage | MRR/subs by plan, reward liability, payouts, refunds/chargebacks |
| `/admin/webhooks` | WebhookOpsPage | Stripe billing-event health; re-drive stuck idempotent events |
| `/admin/fraud` | FraudPage | Flag/resolve subjects; open flag = minting blocked + payout approval blocked |
| `/admin/referrals` | ReferralsPage | Per-referrer ledger: attributed/paying/pending/payable/paid + payout method |
| `/admin/attribution` | AttributionPage | Look up + override a referred user's attribution (confirmed, reasoned, audited) |
| `/admin/auth-security` | AuthSecurityPage | OTP toll-fraud stats + tunable rails (geo allowlist, ceilings) |
| `/admin/audit` | AuditLogPage | Search/filter/paginate every audited action, before/after JSON |

Shared chrome: `AdminShell` (nav + Internal badge), `AdminUI` (`money`, `TableSkeleton`, `PromptDialog` — the one confirm/prompt primitive for every sensitive action; no `window.confirm` anywhere in the console).

## 2. The money loops G3 closes

```
G3 issues founder code  →  B1 user enters it (validate-code)  →  G1 applies at checkout
        →  referral-resolve attributes the user  →  reward_events mint (fraud-gated)
        →  monthly cron drafts payouts  →  G3 reviews, approves, pays, audits
```

- **Issuance:** `admin_create_founder(_code)` — `_assert_admin()`, format `^[A-Z0-9-]{4,32}$`, citext dedupe (`code_already_exists`), audited. Deactivation (`admin_deactivate_code`) is respected by the live loop: `validate-code` refuses non-`active`/expired codes and non-`active` founders.
- **Legacy path (flagged):** the `redeem-founder-code` edge fn + `founder_codes` table is an older parallel system **not called from the app** (`src/` only invokes `validate-code` / `referral-resolve`). Lovable: retire or reconcile it so there is exactly one redemption path.
- **Payout drafting:** `create_monthly_payout_drafts()` (pg_cron, service-role only) → `create_payout_batch` claims payable cash `reward_events` by setting `payout_id` — a reward row can never be batched twice.

## 3. The trust boundary (RLS is the security; the client gate is UX)

- `RequireAdmin` = UX only: fail-closed (`isCurrentUserAdmin()` returns false on any error), loading state never flashes content, deny → redirect `/`, injects `noindex,nofollow`.
- **Real boundary, verified:** every admin RPC is `SECURITY DEFINER` + `has_role(auth.uid(),'admin')` (or `_assert_admin()`, ERRCODE 42501) with `REVOKE ... FROM PUBLIC, anon`. Verified across: founders/codes CRUD, fraud flags, payout machine, `admin_search_audit_logs`, `admin_attention_summary`, `admin_finance_summary`, `admin_otp_stats`, `admin_set_app_setting`, `admin_referrer_ledger`, `admin_billing_events`, `admin_list_payouts`, `admin_attribution_for_user`, `admin_override_attribution`.
- Admin edge functions either check `has_role` directly (`admin-payouts`, `admin-founders`, `admin-redrive-billing-event`) or call the admin-gated RPC **with the caller's JWT** (`admin-audit-search`, `admin-attribution-override`) so a non-admin gets `forbidden` from the database. No service-role call path is reachable by a non-admin.
- **Privilege escalation:** impossible from the client — `user_roles` has SELECT-only policies; role writes are service-role only.
- **Known-acceptable read:** `codes` has an `Anyone can read active codes` policy (needed for validation); a non-admin hitting the table sees only active code values (public-by-design share codes), never founders' earnings.
- **Never-leak:** no user-facing surface links `/admin` (verified by repo-wide grep; `GlobalCaptureFlow` explicitly excludes admin routes from capture UI). **G2 handoff:** the admins-only entry link in user settings does not exist yet — G2 must gate it on `isCurrentUserAdmin()`.

## 4. Payout state machine — safety rules (hardened 2026-07-08)

`draft → approved → processing → paid | failed`, `failed → draft` (retry only).

| Guarantee | Enforced by |
|---|---|
| Approve requires explicit confirm with amount + recipient + method | PayoutBatchesPage `PromptDialog` (no one-click approve) |
| Approve is idempotent | `UPDATE ... WHERE status='draft'` — a retry raises `payout_not_draft`; dialog `busy` guard blocks double-click |
| No payout method → cannot approve | `approve_payout` raises `no_payout_method` |
| **Open fraud flag → cannot approve** | `approve_payout` raises `recipient_fraud_flagged` (migration `20260708000000`); UI disables Approve + shows ⚠ on flagged rows. Resolving the flag releases the hold |
| Paid requires provider reference | edge guard (`provider_id_required`) + table CHECK `payouts_paid_needs_provider` |
| Paid is idempotent | `WHERE status IN ('approved','processing')` — a second call raises `payout_not_approved` |
| Paid settles rewards exactly once | flips `reward_events` `payable→paid` by `payout_id` |
| Failed requires a reason | edge guard + table CHECK `payouts_failed_needs_reason` |
| **A paid payout can never be re-failed (double-pay path closed)** | `mark_payout_failed` now guarded `WHERE status IN ('approved','processing')` → `payout_not_failable` (migration `20260708000000`). Previously it matched on id alone: paid→failed→retry→draft→approve→paid would have paid twice |
| Retry only from failed | `retry_payout` raises `payout_not_failed` otherwise |
| Every transition audited | `write_audit` inside each RPC (actor = `auth.uid()`, before/after JSON) |

**Lovable review ask:** migration `20260708000000_payout_state_machine_guards.sql` re-declares `mark_payout_failed` + `approve_payout` with the two guards above (defense-in-depth, same pattern as `20260627000000`). Please review/own it as part of the server boundary.

## 5. Audit coverage (verified)

Audited with who/what/when + before/after: `approve_payout`, `mark_payout_paid`, `mark_payout_failed`, `retry_payout`, `payout_drafts_created` (cron), founder create/pause/resume/revoke/reward-profile edit, code create/deactivate, `fraud_flag_created`/resolved, `override_attribution`, `admin_set_app_setting`. `AuditLogPage` searches by action/entity/invoice with pagination via admin-gated `admin_search_audit_logs`. Reads (summaries, ledgers, stats) are intentionally unaudited.

## 6. Finance numbers (source of truth)

`admin_finance_summary` computes from Stripe-sourced rows (`subscriptions`, `reward_events`, `payouts`, `billing_events`); the page footer instructs reconciling against the Stripe dashboard. "Blocked payouts" on the Home cockpit = referrers with payable cents and **no payout method** (matches `approve_payout`'s refusal — the number is actionable, not cosmetic). The Payouts CSV export serializes exactly the filtered table rows.

## 7. Ops tooling

- **Webhooks:** `admin_billing_events` lists stuck/failed events with the Stripe event id; **Re-drive** re-runs the idempotent money RPC for `invoice_paid`/`invoice_refunded`/`chargeback_created` only; plan events must be re-sent from Stripe (documented in-page).
- **Auth security:** `adminSetAppSetting` (audited) tunes `otp_*` rails with client-side bounds: non-negative numbers only; geo allowlist must be non-empty valid E.164 prefixes (an empty list — which would block all SMS — is refused).

## 8. Guardrails (standing)

1. Never render or link any admin surface for a non-admin; `/admin/*` only.
2. Never move money without a confirm; never bypass the audited RPCs with raw table writes.
3. The client gate is not security — any new admin RPC must ship with `has_role` + `REVOKE FROM PUBLIC, anon` before the console calls it.
4. Any new sensitive action must `write_audit` in the same transaction.
5. Money formatting via `AdminUI.money`; confirms via `AdminUI.PromptDialog` — keep the console one system.
