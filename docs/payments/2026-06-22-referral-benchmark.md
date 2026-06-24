# Referral / Founder Program — World-Class Benchmark
_Date: 2026-06-22 · Source: deep research on Rewardful, Tolt, PartnerStack, ConvertKit, Beehiiv, Webflow Experts, Dropbox, Stripe Atlas + Stripe fraud guidance._

## What top SaaS programs do (and what we map to in COG)

| Pattern | Reference | COG mapping |
|---|---|---|
| **One stable code per affiliate** auto-minted at activation, collision-safe | Rewardful, Tolt | `codes.value` + `profiles.referral_code` (auto on signup via `handle_new_user`) — PRESENT |
| **Tiered roles**: ambassador (higher %) vs. user (flat %) | ConvertKit (50% 12mo + 10–20% after), Beehiiv (up to 60%), Webflow Experts | Founder: $25×3 then $10/mo life · User: $5/mo life — PRESENT |
| **Cookieless attribution** (server-side stash + checkout metadata) | Cello, Rewardful (Stripe-native), Referralful blog | `profiles.pending_code` → checkout metadata → `referral_attributions` — PRESENT |
| **One attribution per buyer**, last-touch wins until checkout | Rewardful, Tolt | `UNIQUE(referred_user_id)` on `referral_attributions` — PRESENT |
| **Atomic discount claim** with release-on-error (no over-redemption) | Stripe Promotion Codes, Rewardful | `claim_founder_code_redemption` RPC — PRESENT |
| **Recurring lifetime commission** minted per invoice, idempotent | Rewardful, Tolt | `record_invoice_paid` + `idempotency_key` — PRESENT |
| **Hold period before payout** (refund / chargeback safety net) | Rewardful default 30 d, Impact 30–60 d | 30 d via `app_settings.reward_hold_days` + `mature_holds()` cron — PRESENT |
| **Refund + chargeback clawback** reverses pending rewards | Rewardful, PartnerStack | `record_invoice_refunded`, `record_chargeback` — PRESENT |
| **Monthly payout drafts** auto-created day 1, admin approves | Rewardful (monthly), PartnerStack (NET-30) | `create_monthly_payout_drafts` cron 1st @ 07:25 UTC — PRESENT |
| **Min payout threshold** (e.g. $25–$50) | ConvertKit $50, PartnerStack $5 | `app_settings.min_payout_cents` — review; add UI copy |
| **Self-service partner dashboard** (link, clicks, paying refs, pending/payable/paid, next draft) | Rewardful, PartnerStack, Cello | `me-referrals` + `me-founder-stats` — PRESENT |
| **Social-proof on share landing** ("Join N who used X's code") | Dropbox, ConvertKit creator pages | Extend `referral-resolve` with `owner_lifetime_referred_count` — **ADDED THIS PASS** |
| **W-9 / W-8 capture before first payout** | Stripe Express, Beehiiv, ConvertKit | `payout_tax_profiles` table + `me-set-tax-profile` — **ADDED THIS PASS** |
| **Annual earnings export for tax** | Stripe 1099 dashboard, ConvertKit | `me-earnings-export` CSV — **ADDED THIS PASS** |
| **Self-referral & multi-account fraud rails** | Siren (always-on), Stripe Radar, Referralful blog | `is_self_referral` check + `fraud_flags` row on suspicion — partial (block exists; auto-flag added) |
| **Webhook redrive + audit log** | Stripe, Rewardful | `admin-redrive-billing-event`, `audit_logs`, `billing_events` — PRESENT |
| **In-product placement** (Settings → Referrals reachable in ≤2 taps) | Dropbox, Notion | Owned by Claude in Settings UI — flagged |
| **Transactional emails**: code redeemed, first reward matured, payout sent | Rewardful, Beehiiv | Deferred — `notify-referral-event` to be added with Resend templates |

## 10 patterns we should keep copying

1. **Last-touch attribution but locked at checkout** — simple to reason about; no disputes.
2. **30-day hold across the board** — single knob, no per-recipient rules.
3. **Monthly cadence, manual approval** — fits a small ops team, avoids payout fraud bursts.
4. **Stable codes + share links over query params** — survives Safari ITP and ad blockers.
5. **One dashboard route per recipient type** (member vs. founder) — clear mental model.
6. **Social proof on the public landing** — proven Dropbox/ConvertKit lift on CR.
7. **Tax profile gate before payout** — required for US 1099 compliance even before scale.
8. **CSV export from day one** — eliminates support tickets at tax time.
9. **Auto-flag (don't auto-pay) on self-referral/duplicate-card suspicion** — Stripe `payment_method.fingerprint` is the canonical signal.
10. **Live-tunable program params via `app_settings`** — change reward / hold without a deploy.

## What's still TODO after this pass

- Transactional emails (`notify-referral-event`) once Resend templates are signed off.
- Tiered status badges (Bronze/Silver/Gold) — design-driven; defer until Settings UI ships.
- Stripe Connect direct deposit — manual e-transfer/PayPal stays good enough for v1.
- Click tracking on share links (currently we only see redemptions, not click→signup funnel).