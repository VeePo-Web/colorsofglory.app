
# Payments + Referral System — World-Class Benchmark & Gap Closure

## Part 1 — Deep research (world-class reference programs)

I'll run targeted web research on programs that match COG's shape (SaaS subscription, two-sided rewards: power-user "founder/ambassador" tier + regular member referrals, recurring payouts). Then I'll distill what each does well into a one-page checklist we benchmark COG against.

Programs to study:
1. **Dropbox** — the canonical referral flywheel (in-product placement, friction-free share).
2. **Notion / Linear ambassador programs** — creator-tier rewards layered on top of plain referrals.
3. **Superhuman / Cron ambassador codes** — invite-only "founder code" mechanics; perceived scarcity.
4. **ConvertKit / Beehiiv** — recurring cash payouts to creators with public earnings dashboards.
5. **Stripe Atlas / Stripe Apps Partner Program** — clean tax + payout compliance copy.
6. **Rewardful, Tolt, PartnerStack, FirstPromoter** — the de-facto SaaS affiliate tooling — for UX patterns of dashboards, attribution windows, payout cadence, fraud controls.
7. **Webflow Experts / Framer Partners** — tiered status badges that drive ongoing engagement.
8. **PayPal / Wise / Cash App referral mechanics** — best-in-class for instant trust + transparent ledger.

For each I capture: attribution window, cookie/code precedence rules, payout cadence, minimum payout, fraud rails, dashboard layout, share-link UX, email lifecycle, tax handling, churn-clawback policy, in-app placement.

**Deliverable:** `docs/payments/2026-06-22-referral-benchmark.md` — one-page comparison matrix + 10 concrete patterns we should copy.

## Part 2 — Audit COG against the benchmark

Re-walk the stack now that all 6 pending migrations are applied. For each pillar, mark PRESENT / PARTIAL / MISSING and link the code:

| Pillar | What "world-class" looks like |
|---|---|
| Code creation + uniqueness | Auto-mint founder code on grant; auto-mint personal referral code on signup; collision-safe |
| Attribution capture | Link click → cookie/profile stash → checkout metadata → DB row, with one-attribution-per-buyer lock |
| Discount delivery | $50 off Pro (founder code → $49 price), zero overshoot of `max_redemptions`, atomic claim/release |
| Reward minting | Founder $25×3 then $10/mo life; Member $5/mo life; deterministic per invoice |
| Hold + clawback | 30-day hold; refund/chargeback reverses pending; documented |
| Maturation | Daily cron at 07:17 UTC matures `pending → payable` |
| Payout drafts | Monthly cron creates per-recipient drafts; admin approval; mark paid/failed |
| Recipient dashboards | `me-referrals` (member) + `me-founder-stats` (founder): code, link, active subs, pending/payable/paid, next draft date, recent invoices |
| Admin oversight | Finance summary, referrer ledger, billing events, payouts, fraud flags, attribution override, event redrive |
| Fraud rails | OTP throttle, self-referral block, duplicate-payment-method flags, manual review queue |
| Notifications | Email when first reward matures, when payout sent, when code redeemed |
| Tax / 1099 readiness | Yearly earnings export per recipient; W-9/W-8 capture before first payout |
| Live mode readiness | Live Stripe key + webhook arrive automatically on go-live (already documented) |

## Part 3 — Gap closure (implementation)

Based on Part 2, the likely concrete additions (final list confirmed after the audit pass — none ship until you approve):

1. **Notifications layer** — three transactional emails via Resend connector:
   - `referral_first_redeemed` — fires when a code is first redeemed.
   - `reward_matured` — fires when a recipient's first reward moves to `payable`.
   - `payout_sent` — fires when admin marks a draft `paid`.
   Edge function `notify-referral-event` triggered by DB triggers on `reward_events` + `payouts`.

2. **Recipient yearly earnings export** — `me-earnings-export` edge function returns CSV (date, invoice id, gross cents, reward cents, status) for the calendar year. Powers tax-time self-service.

3. **Tax info capture** — `payout_tax_profiles` table (W-9/W-8 minimal: legal_name, country, tax_id_last4, form_type, signed_at). Required before `approve_payout`. Migration + `me-set-tax-profile` edge function + SDK wrapper. RLS: user reads/writes own; service_role full.

4. **Self-referral + duplicate-card fraud rail** — extend `record_invoice_paid` to flag `reward_events.status = 'review'` (not `pending`) when buyer's `payment_method.fingerprint` matches referrer's prior payment method, or buyer email domain matches referrer's. Surfaces in admin `fraud_flags` queue. New `app_settings.fraud_review_enabled` bool default true.

5. **Public earnings counter on referral share page** — extend `referral-resolve` to return `owner_lifetime_referred_count` so the landing page can show "Join 47 songwriters who used Parker's code" social proof (a Dropbox/ConvertKit pattern).

6. **Docs** — append benchmark findings + new endpoints to `docs/claude-handoffs/2026-06-22-payments.md` and update `.lovable/plan.md`.

## Out of scope

- Frontend (Claude owns Settings → Referrals, Settings → Founder, Settings → Payouts pages).
- Stripe Connect / instant payouts — manual PayPal/e-transfer approval flow stays.
- Tiered ambassador status badges (defer — needs design pass first).
- Changing reward amounts or hold days (live-tunable via `app_settings`).

## Files touched (estimated)

- `docs/payments/2026-06-22-referral-benchmark.md` (new — research output)
- `supabase/migrations/20260622190000_cog_payout_tax_profiles.sql` (new)
- `supabase/migrations/20260622190100_cog_fraud_review_minting.sql` (new)
- `supabase/functions/notify-referral-event/index.ts` (new)
- `supabase/functions/me-earnings-export/index.ts` (new)
- `supabase/functions/me-set-tax-profile/index.ts` (new)
- `supabase/functions/referral-resolve/index.ts` (extend payload)
- `src/integrations/cog/{founders.ts,referrals.ts,billing.ts}` (SDK wrappers)
- `docs/claude-handoffs/2026-06-22-payments.md`, `.lovable/plan.md` (notes)

Approve and I'll execute Part 1 (research) first, share the benchmark doc, then proceed to Parts 2–3.
