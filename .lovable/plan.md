## Goal

Every Colors of Glory account automatically gets a personal referral code. Anyone who signs up with that code and becomes a paying Pro subscriber earns the referrer **$5/month, every month, for as long as the referred user keeps paying**. Rewards stack with no cap (5,000 active referrals = $300k/yr). The referrer sees their code everywhere it matters (home, settings, onboarding, dedicated page) and can copy the link in one tap.

## How this fits what already exists

Most of the backend plumbing is already built for the founder program — we're reusing it and turning on the user side:

- `profiles.referral_code` is already auto-generated for every user (8-char A–Z + 2–9 alphabet via `generate_referral_code()`).
- `codes.kind = 'user_referral'` and `attribute_referral()` already handle user codes.
- `record_invoice_paid()` already writes a reward event when a referred user's invoice is paid — it currently writes a $10 *service credit*. We change it to a **$5 cash reward** that flows into the existing founder-style payout pipeline.
- `reward_events`, `mature_holds`, `payouts`, `approve_payout`, `mark_payout_paid`, the 30-day clawback hold, and refund/chargeback reversal all already work — we just teach the payout side that payouts can belong to either a founder or a user.

So this is one schema migration, one webhook-path tweak, one cron extension, an admin payouts UI extension, and the user-facing surfaces.

---

## 1. Database migration

### 1a. Settings + reward shape

- Add `app_settings.user_referral_cash_cents = 500` (the new $5/mo).
- Keep `user_credit_cents` around but unused by the new path (legacy service credits stay valid until consumed).

### 1b. Each profile gets a real `codes` row

`attribute_referral()` resolves through the `codes` table, so every user needs a matching `kind='user_referral'` row whose `value` equals their `profiles.referral_code`.

- Trigger on `profiles` insert/update: upsert a `codes` row `{ value = referral_code, kind='user_referral', owner_user_id = user_id, status='active' }`.
- Backfill: insert that row for every existing profile.
- If `referral_code` changes, deactivate the old code row.

### 1c. Payouts table supports user referrers

```text
payouts:
  founder_id  uuid NULL          (was NOT NULL)
  user_id     uuid NULL          (new, FK profiles.user_id)
  CHECK (founder_id IS NOT NULL) <> (user_id IS NOT NULL)
```

- New SECURITY DEFINER function `create_user_payout_batch(_user, _period_start, _period_end)` mirroring `create_payout_batch` but scoped by `referrer_user_id`.
- New RLS policy: `Referrer user views own payouts` — `user_id = auth.uid()`.
- Admin policies on `payouts` keep working unchanged.

### 1d. `record_invoice_paid` — user branch becomes cash

In the `referrer_type = 'user'` branch:

- Read `user_referral_cash_cents` (default 500).
- Insert `reward_events` with `reward_kind='cash'`, `referrer_user_id=…`, `hold_until = now()+30d`, `status='pending'`. **Stop writing to `credit_ledger`.**
- Idempotency key unchanged.
- Per-month dedupe is already handled because Stripe issues one invoice per billing period and `idempotency_key` keys on the invoice id, so a paying user generates exactly one $5 reward per month per referrer. Stacking is automatic — 5,000 paying referrals = 5,000 reward rows × $5 = $25,000 payable that month.

### 1e. Self-referral and abuse guards

- Already blocked: `attribute_referral` raises `self_referral_not_allowed`.
- Add: if `referred_user_id = referrer_user_id` slips through (e.g. account merge), `record_invoice_paid` skips the insert.
- Fraud signals already write to `fraud_flags` on chargebacks; same code path handles user referrals.

### 1f. Payout method on the profile

Add nullable columns on `profiles` so the user can tell us how to pay them:

- `payout_method` enum (`'stripe_connect' | 'paypal' | 'manual'`)
- `payout_email` text (used for PayPal or manual)
- `payout_country` text
- `stripe_connect_account_id` text (filled later when we wire Stripe Connect)

For launch we mark all payouts as **manual** — admin marks them paid by hand from the dashboard. Stripe Connect onboarding is a follow-up; the schema is ready for it.

---

## 2. Edge function changes

### 2a. `rewards-mature-worker` (cron, daily)

Already runs `mature_holds()` and, on day 1, creates monthly founder payout drafts. Extend the day-1 block:

- After founders, loop over every `profiles.user_id` that has any `payable` cash `reward_events` for the prior month and call `create_user_payout_batch`.
- One SQL query, no per-user fetch loop in JS.

### 2b. New edge function: `me-referrals`

Authenticated. Returns:

```ts
{
  code: string;
  link: string;                 // https://colorsofglory.app/r/<CODE>
  attributed_count: number;     // total people who signed up with the code
  paying_count: number;         // currently Pro
  earnings: {
    pending_cents: number;      // in hold
    payable_cents: number;      // matured, not yet paid out
    paid_cents: number;         // already paid
    lifetime_cents: number;     // pending + payable + paid
  };
  next_payout_estimate_cents: number;  // sum of payable as of today
  recent_referrals: Array<{
    referred_at: string;
    is_paying: boolean;
    months_active: number;
    total_earned_cents: number;
  }>;
  payout_method: { kind: string | null; email: string | null; country: string | null };
}
```

Pure read RPC, no writes. Used by the dashboard, the home card, and the settings panel.

### 2c. New edge function: `me-set-payout-method`

POST `{ method, email, country }`. Zod-validated. Writes to `profiles`.

### 2d. Public landing redirect

Light edge function (or simple SPA route) for `/r/:code` that captures the code into `localStorage` (or sets a `Set-Cookie`) and redirects to `/` so the existing signup flow attaches the attribution after sign-up. The attribution step itself is already implemented by the `referral-attach` function.

### 2e. Admin payouts UI

`admin-payouts` RPC + page already render a list per period. Extend the payload so each row carries either `founder_id` or `user_id` plus a display name pulled from `founders` or `profiles`. The existing approve / mark-paid actions work unchanged because they key on `payout_id`.

---

## 3. Typed SDK (`src/integrations/cog/*`)

Add three thin helpers Claude's pages will consume:

- `getMyReferrals()` → calls `me-referrals`.
- `setMyPayoutMethod(input)` → calls `me-set-payout-method`.
- `buildReferralShareUrl(code)` → returns `https://colorsofglory.app/r/<code>`.

All input validated with Zod.

---

## 4. User-facing surfaces (handed to Claude — Lovable does not touch `src/pages/**` / `src/components/**`)

Spec for Claude to build, all using the existing cream + gold tokens:

### 4a. `/referrals` — dedicated dashboard

Mobile-first. Sections in order:
1. Hero: serif "Invite. Earn $5/month. Forever."
2. Big code card — code in large mono, one-tap "Copy code" + "Copy link" buttons + native Web Share.
3. Earnings strip — Pending / Payable / Lifetime, with a small "Next payout (1st of month)" line.
4. Math callout — "1 friend = $5/mo · 100 friends = $6,000/yr · 5,000 friends = $300,000/yr."
5. Referred users list — anonymized rows (initial + month joined + status pill: Free / Pro / Lapsed) + months active + lifetime $.
6. Payout method card — current method + "Set up payouts" CTA. While unset, banner: "Your $X is waiting — add a payout method to release it."
7. FAQ accordion (self-referral, hold period, refunds reverse rewards, taxes are the referrer's responsibility).

### 4b. Settings panel section

Compact: code, copy button, link to `/referrals`, lifetime earned.

### 4c. Persistent share card on Home/Catalog

Small dismissible-for-the-session gold-bordered card with code + "Copy link · Earn $5/mo per friend." Tapping opens `/referrals`.

### 4d. Onboarding screen — new step `referral_program_seen`

Inserted into the onboarding ladder after `intent_selected` (or right before `first_song_created`). Single screen:
- Headline: "Your code earns $5/month — forever."
- Subhead explaining: anyone who joins Pro with your code pays you $5/mo for as long as they stay subscribed.
- Their code, prominent, with Copy + Share buttons.
- Math line: "5,000 people = $300,000/year potential."
- Continue button advances the step.

Add `'referral_program_seen'` to the `onboarding_step` enum and to `onboarding_legal_next` / `onboarding_step_rank`, slotted between `intent_selected` and `founder_code_seen`. Existing users at later steps are unaffected.

---

## 5. What stays the same

- 30-day clawback hold before a reward becomes payable.
- Refunds and chargebacks reverse the matching reward via existing functions.
- Direct-only attribution (no MLM chain) — already enforced.
- Founder rewards rule from the previous change ($25 × 3 then $10) is untouched.
- Service credit applied to invoices keeps working for any legacy `credit_ledger` rows; we just stop creating new ones.

## 6. Out of scope (explicit)

- Stripe Connect onboarding flow. Schema is ready; first payouts go out manually.
- Multi-currency. All rewards are in the project's existing currency (CAD).
- Leaderboards / public bragging surfaces.
- A "minimum payout threshold" (Stripe Connect will introduce one naturally later).
- Retroactive conversion of existing $10 service-credit rewards into cash. Anything earned before this ships stays a credit.

## 7. Build order (one PR each, in this order)

1. Migration: settings, codes auto-row trigger + backfill, `payouts.user_id`, `create_user_payout_batch`, RLS policy, `record_invoice_paid` user branch → cash, profile payout columns.
2. Edge functions: `me-referrals`, `me-set-payout-method`, extend `rewards-mature-worker` and `admin-payouts`.
3. Typed SDK helpers.
4. Onboarding enum + ladder update.
5. Hand off to Claude: `/referrals` page, settings section, home card, onboarding screen.
