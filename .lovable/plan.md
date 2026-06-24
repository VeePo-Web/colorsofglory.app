## Payments + Referral System Audit & World-Class Hardening

### Current state (already shipped)
- **Founder codes**: `$50 off` first paid month via Stripe coupon, attribution stamped on checkout metadata
- **Reward minting**: `record_invoice_paid` → Founder gets $25 (first invoice) / $10 (recurring), regular Members get $5
- **30-day hold → maturation cron (07:17 UTC daily)** → monthly payout drafts cron (1st @ 07:25 UTC)
- **Admin ops**: `approve_payout`, `admin_finance_summary`, `admin_referrer_ledger`, `admin_billing_events`, `admin_list_payouts`, `admin_fraud_flags`
- **Founder dashboard endpoint**: `me-founder-stats` (code, share link, redemptions, earnings buckets, next draft date)
- **Tax**: `payout_tax_profiles` (W-9/W-8) + `me-set-tax-profile`
- **Fraud**: self-referral trigger auto-flags into `fraud_flags`; OTP toll-fraud rail
- **Tracking**: `billing_events`, `reward_events`, `referral_attributions`, `payouts`, `fraud_flags`
- **Self-service**: `me-earnings-export` (CSV), `referral-resolve` returns lifetime social-proof count

### World-class benchmark gaps to close
Based on Dropbox / Notion / ConvertKit / Superhuman / Rewardful / Tolt / Wise patterns, five gaps remain:

1. **Lifecycle notifications** (Dropbox/ConvertKit pattern)
   - Resend emails: `referral_first_redeemed`, `reward_matured`, `payout_sent`, `payout_failed`
   - New edge fn `notify-referral-event` triggered by DB triggers on `reward_events` and `payouts` status changes
   - Per-user mute toggle in `profiles.notification_prefs`

2. **Referrer-side dashboard endpoint for regular Members** (parity with founders)
   - `me-referral-stats` mirroring `me-founder-stats` for non-founder users (regular $5/referral track)
   - Returns: personal referral code, share link, redemptions, pending/payable/paid buckets, next payout date

3. **Payout method capture** (Wise/Stripe Connect pattern, minimum viable)
   - Extend `payout_tax_profiles` → add `payout_method` (paypal_email | stripe_connect_id | manual_check) + payout instructions
   - New endpoint `me-set-payout-method`; admin `approve_payout` blocks if missing
   - Surface in `me-founder-stats` / `me-referral-stats` as a "complete payout setup" prompt

4. **Operational alerting + reconciliation** (Stripe Atlas pattern)
   - Daily `reconcile-billing-events` cron: scans Stripe invoices vs `billing_events` last 48h, inserts a `fraud_flags` row with `kind = 'reconciliation_drift'` on mismatch
   - Admin endpoint `admin_reconciliation_report` to list drifts

5. **Public ledger transparency** (Notion/Superhuman trust pattern)
   - Extend `me-founder-stats` and `me-referral-stats` with per-event timeline (status transitions: minted → matured → drafted → paid)
   - Already have data in `reward_events` + `payouts`; just compose the response

### Out of scope
- Frontend dashboards (Claude territory — handoffs already written)
- Stripe Connect onboarding UX (defer; PayPal/manual covers v1)
- Multi-currency payouts (USD only at launch)
- Changing reward amounts, hold days, or cohort definitions (live-tunable in `app_settings`)

### Files

**Migrations (1 new):**
- Extend `payout_tax_profiles` with payout method columns
- Add notification preference JSONB to `profiles`
- Triggers on `reward_events.status` and `payouts.status` → enqueue notification rows
- `notification_queue` table (id, user_id, kind, payload, sent_at, attempts, error)

**Edge functions (3 new, 0 modified):**
- `notify-referral-event` (cron every 5min, drains `notification_queue` via Resend)
- `me-referral-stats` (parity with `me-founder-stats` for regular members)
- `me-set-payout-method`
- `reconcile-billing-events` (daily cron)

**Existing endpoints extended:**
- `me-founder-stats` → adds `payout_method_complete`, `event_timeline[]`
- `approve_payout` SQL fn → block when `payout_method` missing

**SDK (`src/integrations/cog/`):**
- `payouts.ts` → add `setMyPayoutMethod`, `getMyPayoutMethod`
- `referrals.ts` → add `getMyReferralStats`
- `founders.ts` → updated response type

**Docs:**
- Append "Notifications + Payout Method + Reconciliation" section to `docs/claude-handoffs/2026-06-22-payments.md`
- Update `.lovable/plan.md` audit log
- Update `docs/payments/2026-06-22-referral-benchmark.md` with final gap-closure matrix

### Verification
After build:
1. Run `debug_seed_reward_chain` for both founder + regular member to confirm both dashboards populate
2. Verify notification triggers fire (check `notification_queue`)
3. Approve a test payout with missing payout method → expect error
4. Trigger `reconcile-billing-events` → expect zero drifts on clean state

Approve to ship?