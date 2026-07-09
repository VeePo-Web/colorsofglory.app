# REFERRAL CONTRACT — F3 · Referral Growth Loop

**Owner:** F3 (user-facing referral growth). **Status:** shipped 2026-07-08.
**Mission:** collaboration itself becomes the invitation (Product Vision 14) — calm in-song
prompts at real collaboration moments, one warm share flow, claimable vanity codes, an honest
earnings dashboard, and a `/r/:code` landing that always attributes and never dead-ends.

---

## 1. The F3 / G3 money boundary (LAW)

| | F3 (this lane) | G3 (admin) |
|---|---|---|
| Earnings | **SHOWS** the user their own earnings (`fetchReferralStats` → hero, stats grid, momentum feed) | Processes `reward_events`, reconciliation |
| Payout | **COLLECTS** the destination (`setMyPayoutMethod` — where to send *their* money) | **PROCESSES** payouts, issues money |
| Console | never touches `admin/ReferralsPage.tsx` | owns it |

F3 never processes, reconciles, or issues money. "Payouts/accounting = admin."

## 2. Data consumed (read-only — A3 + G1 lanes)

- `@/integrations/cog/referrals.ts` (A3): `claimReferralCode`, `setMyPayoutMethod`,
  `resolveCode`, `attachReferral`, `buildReferralShareUrl`. Never raw queries.
- `@/lib/pricing/pricingApi.fetchReferralStats` (G1): the one stats read for the dashboard
  and the share sheet's self-load. Consumed read-only.

## 3. In-song prompt: trigger moments + frequency rules

**Moments** (`ReferralMoment` in `src/components/referral/referralPromptState.ts`):

| Moment | Fired by | When |
|---|---|---|
| `invite_sent` | People screen (`PeoplePage`) | Owner successfully sends an invite or generates an invite link — they're already in sharing mode |
| `collaborator_joined` | `ReferralPromptHost` itself | The song's member count grew since this device last saw it (host receives `collaboratorCount`) |
| `milestone` | any future host (credits export, first collaborative song…) | reserved — same API, same caps |

**Calm rules (all persisted in `localStorage["cog:referral-prompt:v1"]`, per device):**
1. Each moment fires **at most once per song, ever**.
2. Globally **at most one prompt per 7 days**, across all songs and moments.
3. **"Don't show again" is a permanent global opt-out.**
4. The prompt is a bottom-anchored card, **never a modal**: no backdrop, no focus trap,
   never blocks the flow; appears ~900ms after the moment so the host's own success UI
   settles first; z-index 780 (below every sheet at 799+).
5. If no host is mounted, `triggerReferralPrompt()` is a safe no-op.

## 4. The host API (what B3 / other lanes call)

```tsx
import ReferralPromptHost from "@/components/referral/ReferralPromptHost";
import { triggerReferralPrompt } from "@/components/referral/referralPromptState";

// 1. Mount once on the host surface (renders nothing until a moment fires):
<ReferralPromptHost songId={songId} collaboratorCount={members.length /* optional */} />

// 2. Fire a moment at the collaboration event (safe to call unconditionally —
//    all caps/dismissal logic lives on F3's side):
triggerReferralPrompt("invite_sent", songId);
```

F3 never edits host screens' internals beyond these two lines. **B3 slot request:** the
invite flow screens (`src/pages/invite/*`) may fire `invite_sent` the same way after their
own send-success moment; the caps make double-fires harmless.

## 5. The ONE share surface

`ShareReferralSheet` (`src/components/referral/ShareReferralSheet.tsx`) is used by BOTH the
dashboard and every prompt. Native share sheet first, clipboard fallback
(`copyTextToClipboard`), and the canonical message lives in ONE place:
`REFERRAL_SHARE_MESSAGE` in `src/components/referral/shareReferral.ts`. Copy never diverges.

## 6. Vanity codes

`VanityCodeClaim` (dashboard, under the link card) surfaces `claimReferralCode`:
3–20 chars A–Z/0–9, uppercase-normalized, errors mapped (`code_taken` → "That code is
taken — try another.", `invalid_code` → "Codes are 3–20 letters or numbers."). On success the
dashboard refetches stats so the new `/r/<name>` flows into the link card, the share sheet,
and the in-song prompts (which self-load the link).

## 7. `/r/:code` landing → G1 checkout attribution handoff

`ReferralRedirectPage` (`/r/:code`, public route):

1. **Stash immediately:** `sessionStorage["cog:referral-code"] = CODE` (uppercased) — before
   resolution, so a refresh never loses attribution.
2. **Resolve** (`resolveCode`) to personalize the welcome ("«Name» invited you"); explicit
   `ok:false` (invalid/expired) **clears the stash** so checkout never sees a phantom code;
   network error/timeout (2.5s cap) keeps it — checkout re-validates.
3. **Attribute:** signed-in visitors get `attachReferral(code)` fired best-effort (stashes
   server-side for checkout). Anonymous visitors attribute at signup/checkout via the stash.
4. **Continue:** always lands on `/upgrade?ref=CODE` (valid) or `/upgrade` (bad code) after
   ~1.8s, with an always-visible "Start your first song" button. **Never a dead end** — every
   branch (valid / invalid / expired / offline / no code) renders the warm branded welcome
   and then continues.

**G1 owns consumption:** `UpgradePage` reads `?ref=` + the sessionStorage key (verified at
`src/pages/pricing/UpgradePage.tsx:260,294`) and validates via `validate-code`. F3 must never
change the key name `cog:referral-code` or the `?ref=` param without G1.

## 8. Route guard (A5)

`/settings/referral` is wrapped in `RequireAuth` (`src/routes/settingsRoutes.tsx:26`) — the
gap A5 flagged was already closed; verified, no action needed. `/r/:code` and `/upgrade`
stay public by design (a shared link must resolve for a not-yet-authed visitor).

## 9. Accessibility + calm states

- Dashboard: loading shimmers honor `motion-reduce`; stats tiles carry `aria-label`s;
  zero-state is a warm invitation, not an empty error; copy/share/claim controls labeled.
- Prompt: `role="complementary"`, labeled dismiss, no focus trap, reduced-motion honored.
- Share sheet: `role="dialog"`, Escape closes, reduced-motion honored.
- Landing: `role="status"` progress line, reduced-motion honored, CTA always visible.

## 10. Files in this lane

```
src/components/referral/
  referralPromptState.ts   caps + dismissal persistence + trigger bus
  ReferralPrompt.tsx       the calm nudge card (presentational)
  ReferralPromptHost.tsx   mount-once host; join detection; opens the sheet
  ShareReferralSheet.tsx   the ONE share surface
  shareReferral.ts         canonical message + one-tap share helper
  VanityCodeClaim.tsx      claim a memorable /r/<name> code
src/pages/settings/ReferralPage.tsx      dashboard (polish only — earnings view + payout collect)
src/pages/pricing/ReferralRedirectPage.tsx  the /r/:code warm front door
```
