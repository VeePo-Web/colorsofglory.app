# Referral System — World-Class UX Benchmark & Gap Audit
### How the best referral programs feel, and exactly where Colors of Glory can be smoother
*By the Admin/Backend Claude. Lane note: I own the referral **backend + admin + link infrastructure**. The referrer-facing **screens** are the onboarding Claude's lane — findings below are tagged `[BACKEND/ADMIN — mine]` or `[REFERRER UI — handoff]` so nobody clashes. Last updated 2026-06-22.*

---

## 1. Method
Grounded in current (2025–26) referral-UX research + the canonical programs (Dropbox, PayPal, Wise, Cash App, Revolut, Tesla). Sources at the bottom. Then a dimension-by-dimension audit of COG's actual implementation (codes, attribution, rewards, payouts, links) with concrete, owner-tagged fixes.

## 2. What the best programs do (the benchmark)

| Program | Mechanic | Why it's smooth |
|---|---|---|
| **Dropbox** | Two-sided, **same currency as the product** (500 MB each, up to 16 GB) | Reward is *inside* the product — instant, no payout friction. 3,900% growth. |
| **PayPal** | $10 referrer / $10 referee, cash | Dead-simple symmetric cash; pioneered digital referral. |
| **Wise** | Referrer earns after 3 referees each transfer ≥ $200; referee gets a free transfer | Clear threshold + dual value; anti-gaming built into the milestone. |
| **Cash App / Revolut** | One-tap share, in-app, instant credit on qualifying action | Native share sheet, deep links, instant dopamine. |
| **Tesla** | Tiered/status rewards | Aspirational, non-cash, status-driven. |

**The 4 cross-cutting laws they all obey:**
1. **Two-sided** — both referrer and referee get something, stated upfront.
2. **Frictionless share** — one tap, prefilled message, native share sheet, memorable/branded code, deep link to the *exact* destination (deep links convert 2–3× generic links).
3. **Instant feedback loop** — notify the moment a friend signs up / converts; reward feels immediate even if cash settles later (delayed reward = lower perceived value).
4. **Transparent tracking** — a dashboard showing each referral's status + earnings, and a frictionless path to actually withdraw.

## 3. The 10 UX dimensions — COG audit

Scoring: ✅ strong · ⚠️ partial · ❌ gap.

### 1. Two-sided incentive — ⚠️
COG **is** two-sided: referrer earns cash (founder `reward_profile`, or `user_referral_cash_cents` = $5), and the referee gets a discount via the code (`discount_cents`) on top of "first song free." But the referee-side value isn't crisply standardized the way "$10/$10" or "500 MB each" is.
- `[REFERRER UI — handoff]` State the referee benefit explicitly in the share message + the referee landing ("You get X, your friend gets Y").
- `[BACKEND/ADMIN — mine]` Expose the referee discount in `getMyReferrals` so the share copy can say it precisely (currently the referrer summary doesn't return the referee-side benefit).

### 2. Frictionless share — ⚠️
Link works (`colorsofglory.app/r/CODE`), and `me-referrals` returns `link` + `code`.
- `[REFERRER UI — handoff]` Native share sheet (`navigator.share`), one-tap copy with "copied!" toast, prefilled message — these are the single biggest lever (one case: +50% referrals from mobile share polish). Currently `ReferralPage` shows a link placeholder.
- `[BACKEND/ADMIN — mine]` Provide a ready-to-send prefilled message string in `me-referrals` so every surface shares identical, on-brand copy.

### 3. Memorable / branded codes — ❌
User referral codes are **random 8-char** (`generate_referral_code` → e.g. `K7P3M9Q2`). Best practice is memorable/personalized (`KATE-10`) — far more shareable verbally and in DMs. Founders fare better (slug-based).
- `[BACKEND/ADMIN — mine]` Let users **claim a custom referral handle** (e.g. first-name + number, uniqueness-checked) mapping to their attribution — a small backend feature (vanity code column + claim RPC). High shareability ROI.

### 4. Deep link to the right destination — ⚠️
`/r/CODE` → `/upgrade?ref=CODE`. It lands the referee on the **paywall/upgrade** page, not on the product value or a tailored "your friend gave you X" welcome. Research: route to product/value or a dedicated referee landing, not a generic page; deep links to intent convert 2–3×.
- `[REFERRER UI / ONBOARDING — handoff]` Make `/r/:code` land on a **referee welcome** that shows the gift + drops into the first-song aha, carrying the code through signup (auto-applied), rather than straight to upgrade.
- `[BACKEND/ADMIN — mine]` Ensure the code survives the whole signup→checkout path (it already stashes onto the profile via `referral-attach`; confirm it auto-applies so the referee never re-enters it).

### 5. Instant feedback loop — ⚠️
COG rewards are minted on paid invoice, held ~30 days (clawback), matured to payable, paid monthly. That's the *correct* fraud posture, but cash is **delayed** — and delayed reward lowers perceived value.
- `[BACKEND/ADMIN — mine]` Keep the hold, but make the *acknowledgment* instant: emit an activity/event the moment a referee signs up and again when they convert (so the referrer feels it immediately even though cash matures later). `me-referrals` already returns `recent_referrals` — add a "just happened" signal/timestamp the UI can surface as a notification.
- `[REFERRER UI — handoff]` Show "pending — matures in N days" as momentum, not a dead "$0 available."

### 6. Transparent earnings dashboard — ✅ (data) / `[handoff]` (screen)
`getMyReferrals` is genuinely strong: code, link, attributed/paying counts, earnings split (pending/payable/paid/lifetime), `next_payout_estimate_cents`, recent referrals, payout method. This is best-in-class *data*. The screen to render it is the onboarding Claude's (spec already in `REFERRER-PAGE-HANDOFF.md`).

### 7. Frictionless "get paid" — ⚠️ (the biggest money gap)
A referrer can earn but **not get paid until they set a payout method** — and nothing proactively nudges that. I built the admin side: `/admin/referrals` + Home cockpit flag referrers who are *owed but blocked*.
- `[REFERRER UI — handoff]` Make "Add payout method" an unmissable CTA the moment they have any pending earnings (it's the unlock). Spec'd in the handoff doc.
- `[BACKEND/ADMIN — mine, done]` Admin visibility shipped. Could add an automated nudge trigger later.

### 8. Anti-fraud that's invisible to good users — ✅
Self-referral CHECK-blocked, `fraud_flags` gate on minting, clawback hold, OTP toll-fraud rails, idempotency. Strong and largely invisible. Admin fraud queue + auth-security monitoring shipped.

### 9. Discoverability / "always one tap away" — ❌
Best practice: referral entry point on home, account, post-value moments, emails. COG has a settings `ReferralPage` + onboarding `EarnPage`, but referral isn't surfaced at high-intent moments (e.g., right after the first song aha, or after a collaborator joins).
- `[REFERRER UI / ONBOARDING — handoff]` Add a gentle "invite a friend, you both get X" prompt after aha moments + a persistent entry in the menu. (Backend is ready; this is placement.)

### 10. Reward salience & ladder — ⚠️
Cash is good, but the *product-native* reward (à la Dropbox storage) is often smoother (no payout friction at all). COG already has storage tiers + plan gates.
- `[BACKEND/ADMIN — mine]` Consider an **optional product-native referee/referrer reward** (e.g., bonus storage or a free month) as an alternative to cash — instant, zero payout friction, and it deepens product usage. Worth a product decision before building.

## 4. Prioritized recommendations

**P0 — highest ROI, mostly mine/backend:**
- **Custom/vanity referral codes** (#3) — small backend feature, big shareability lift. `[mine]`
- **Prefilled share message + referee-benefit in `me-referrals`** (#1, #2) — lets the UI ship one-tap, on-brand sharing. `[mine]`
- **`/r/:code` → referee welcome + auto-apply through signup** (#4) — stop dumping referees on the paywall. `[mine: code-carry; handoff: screen]`

**P1:**
- **Instant referral acknowledgment signal** (#5) `[mine]` + "pending matures in N days" UI `[handoff]`.
- **Proactive "add payout method" nudge** when earnings exist (#7) `[handoff]`.
- **Discoverability at aha moments** (#9) `[handoff]`.

**P2 (product decision first):**
- **Product-native reward option** (storage / free month) (#10) `[mine, after decision]`.

## 5. Net verdict
COG's referral **engine, economics, fraud posture, and admin tooling are already world-class** — arguably ahead of most consumer apps on integrity and admin observability. The gaps are all on the **smoothness of the referrer's share + the referee's first touch**: random codes, no one-tap/prefilled share, paywall-first landing, and delayed-feeling rewards. None require re-architecture — they're additive. The two I can drive immediately in my lane are **vanity codes** and **share-copy/referee-benefit in `me-referrals`**; the rest are teed up for the onboarding Claude in `REFERRER-PAGE-HANDOFF.md`.

## Sources
- [impact.com — Referral Program Guide 2025](https://impact.com/referral/7-proven-strategies-for-growth/)
- [Voucherify — Referral program UX & UI best practices](https://www.voucherify.io/blog/referral-programs-ux-and-ui-best-practices)
- [Viral Loops — Referral best practices 2025](https://viral-loops.com/blog/referral-program-best-practices-in-2025/)
- [ReferralCandy — Dropbox copied PayPal](https://www.referralcandy.com/blog/dropbox-referral-program)
- [GrowSurf — Dropbox 3900% growth](https://growsurf.com/blog/dropbox-referral-program/)
- [ReferralCandy — Psychology of referral rewards](https://www.referralcandy.com/blog/referral-rewards-psychology)
- [Branch — Deep linking benefits & best practices](https://www.branch.io/resources/blog/deep-linking-benefits-and-best-practices/)
- [AppsFlyer — Referral-to-app deep linking](https://www.appsflyer.com/products/deep-linking/referral-to-app/)
