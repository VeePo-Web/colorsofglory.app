# F3 · Referral Growth — Progress Log

One entry per completed step. Canonical spec: `docs/REFERRAL-CONTRACT.md`.
Run date: 2026-07-08 (all 10 steps executed in one session).

## Step 1 — Baseline + F3/G3 boundary ✅
Verified against real files: dashboard (`ReferralPage.tsx`, /settings/referral) already
excellent — earnings hero, stats grid, payout collect, momentum feed, honest rules (polish
only). Data layer (`cog/referrals.ts` + `pricingApi.fetchReferralStats`) complete — nothing
built there. Flagship gap confirmed: zero in-song referral prompts anywhere (grep across
components/, pages/). Vanity claim unsurfaced. `/r/:code` was a bare instant redirect.
**Stale audit note corrected:** `/settings/referral` is ALREADY RequireAuth-guarded
(`settingsRoutes.tsx:26`) — no A5 filing needed. Boundary written into REFERRAL-CONTRACT §1.

## Step 2 — Trigger design ✅
Moments: `invite_sent`, `collaborator_joined`, `milestone` (reserved). Caps: once per
moment per song ever; global 1-per-7-days; permanent "Don't show again" opt-out; state in
`localStorage["cog:referral-prompt:v1"]`. Non-modal bottom card, 900ms settle delay.
Contract §3.

## Step 3 — ReferralPrompt component ✅
`src/components/referral/ReferralPrompt.tsx` — presentational, per-moment warm copy,
gold share CTA, "Not now" ✕, "Don't show again", reduced-motion aware, no focus trap.

## Step 4 — Triggers wired ✅
`referralPromptState.ts` (decision layer + trigger bus) + `ReferralPromptHost.tsx`
(mount-once host; marks caps only when truly shown; detects `collaborator_joined` via
member-count growth). People screen integration = 2 lines: mount host + fire
`triggerReferralPrompt("invite_sent", songId)` on send-success and link-generate-success.
B3's invite screens can fire the same call (slot request documented, contract §4) — caps
make double-fires harmless. Firing with no host mounted is a no-op.

## Step 5 — One share surface ✅
`ShareReferralSheet.tsx` + `shareReferral.ts` (canonical `REFERRAL_SHARE_MESSAGE`, native
share → clipboard fallback, dismissal ≠ failure). Dashboard "Share invite" and the prompt's
"Share your link" both open this one sheet. The old inline message/handler in ReferralPage
was replaced by the shared module — copy can no longer diverge.

## Step 6 — Vanity codes ✅
`VanityCodeClaim.tsx` under the dashboard link card: /r/ prefix input, `^[A-Za-z0-9]{3,20}$`
client validation, uppercase normalize, `code_taken`/`invalid_code` mapped to calm copy,
success refetches stats so the new code flows into link card + share sheet + prompts.
DB trigger keeps the resolver in sync (per referrals.ts doc).

## Step 7 — Dashboard polish ✅
Loading shimmers (motion-reduce aware) for link + stats; `aria-label`ed stat tiles;
calm zero-state ("Share your link with a songwriter you love writing with…"); payout
section untouched in behavior (display + collect only). Confirmed no payout processing
anywhere in the lane: the only money-adjacent calls are `fetchReferralStats` (read) and
`setMyPayoutMethod` (destination collect).

## Step 8 — /r/:code warm landing ✅
`ReferralRedirectPage.tsx` rebuilt as the warm front door: immediate sessionStorage stash
(key `cog:referral-code` unchanged — G1 contract), `resolveCode` personalization
("«Name» invited you"), authed visitors get best-effort `attachReferral`, explicit-invalid
codes clear the stash, network errors keep it (checkout re-validates), 2.5s resolve cap,
~1.8s auto-continue + always-visible CTA. Every branch (valid/invalid/expired/offline/
no-code) lands on /upgrade — never a dead end. G1 handoff documented (contract §7).

## Step 9 — Guard + states + a11y ✅
Route guard verified already present (Step 1). Zero/loading states shipped (Step 7).
A11y: prompt `role="complementary"` no-trap; sheet `role="dialog"` + Escape; landing
`role="status"`; all controls labeled; reduced-motion honored in prompt, sheet, landing,
and shimmers.

## Step 10 — Flywheel verification + contract ✅
Verified by build + typecheck + targeted tests and code-path walk (see final report):
invite → `invite_sent` fires once (cap state persisted) → share sheet → `/r/:code` warm
land + stash/attach → `/upgrade?ref=` (G1 validates) → dashboard reflects via
`fetchReferralStats`. `docs/REFERRAL-CONTRACT.md` published. **Group F complete.**

## Dependencies on other lanes
- **B3:** optional — invite screens may fire `invite_sent` via the documented API.
- **G1:** consumes `?ref=` + `cog:referral-code` at checkout (unchanged); owns attribution consumption.
- **A3:** `cog/referrals.ts` consumed read-only.
- **A5:** no action — the referral route guard already exists.
- **G3:** owns payouts/reconciliation/admin console — F3 verified zero overlap.
