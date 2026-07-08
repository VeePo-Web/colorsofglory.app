# B2 — Onboarding Flow Punch-List (Step 1 audit)

Audited: FirstIntentPage, StartFirstSongPage, EarnPage, CaptureFirstIdeaPage,
VoiceMemoAddedPage, OnboardingProgress, updateOnboardingStep (inviteApi),
routeAfterAuth (postAuthRoute), App.tsx routes.

## The arc (screen → route → step marked → next)

| # | Screen | Route | Step marked | Next |
|---|---|---|---|---|
| 1 | FirstIntentPage | /onboarding/intent | `intent_selected` (on "Start a song") | /onboarding/start-song, or /join (B3), or /onboarding/founder-code (B1) |
| 2 | EarnPage (optional referral awareness) | /onboarding/earn | `referral_program_seen` (on mount) | /onboarding/start-song |
| 3 | StartFirstSongPage | /onboarding/start-song | `first_song_created` | /songs/:id (REAL capture — C2's CaptureScene) |
| 4 | CaptureFirstIdeaPage (guided framing) | /songs/:id/capture-onboarding | `first_idea_captured` — now advanced by the DB trigger on the REAL voice_memo insert | /songs/:id (real recorder) or /songs/:id/lyrics |
| 5 | VoiceMemoAddedPage (celebration) | /songs/:id/voice-added | `first_voice_memo_added` (on mount, monotonic) | /songs/:id, /songs/:id/lyrics, /songs/:id/people (invite) |

Resume: routeAfterAuth (src/lib/auth/postAuthRoute.ts) — checkout > invite >
onboarding step; mid-steps drop the user back INSIDE /songs/:firstSongId;
completed/dismissed → /home.

## Three advancement mechanisms

1. **Manual** `updateOnboardingStep()` in the screens — monotonic, fire-and-forget
   (src/lib/invite/inviteApi.ts, ONBOARDING_STEP_ORDER).
2. **DB triggers** on real inserts (song / voice_memo / lyric / note / invite) —
   the source of truth for real-workflow advancement.
3. **onboarding-set-step edge fn** — its STEPS enum is MISSING
   `referral_program_seen` (backend gap → Lovable; see Handoffs).

## Gaps found (with resolution status)

| Gap | Where | Resolution |
|---|---|---|
| Mock first capture (simulated recording, no audio persisted) | CaptureFirstIdeaPage | FIXED (Step 4): fake takeover removed; mic routes into C2's real recorder at /songs/:id |
| Hardcoded fixture memo ("First melody idea", fake waveform) | VoiceMemoAddedPage | FIXED (Step 5): reads the user's REAL latest memo via listMemosForSong + getPlaybackUrl |
| Raw supabase inserts instead of A3 createSong() | StartFirstSongPage | FIXED (Step 3): migrated to createSong() edge fn; profiles.first_song_id still set client-side (createSong doesn't set it) |
| `?first=1` written but never consumed | StartFirstSongPage → /songs/:id | REMOVED (Step 3 decision): nothing consumes it; C1/C2 own CapturePage so wiring it is out of B2's lane. Flagged to C1 if a first-visit hint is ever wanted. |
| Demo song "1" branch reachable in prod | StartFirstSongPage (no-session path) | FIXED (Step 3): guarded behind import.meta.env.DEV; prod no-session → /auth/login |
| `completed` / `dismissed` never reachable from UI | step machine | PARTIAL (Step 7): calm "I'll finish setting up later" dismiss added on VoiceMemoAddedPage. Automatic `completed` needs a backend trigger (after first_collaborator_invited or first return visit) — handoff to Lovable/A4. |
| Palette drift #FAFAF6 / #B5935A / #1A1A1A / #666 / #999 | all five screens | FIXED (Steps 2/5/9): migrated to A1 tokens (--cog-gold #B8953A, --cog-cream, --cog-charcoal, --cog-warm-gray, --cog-muted). OnboardingProgress still uses #B5935A internally — A1's primitive, flagged, not edited. |
| Edge fn missing `referral_program_seen` | onboarding-set-step | FLAGGED to Lovable — do not edit from frontend lane. |
| Two parallel first-capture experiences | CaptureFirstIdeaPage vs CaptureScene | RESOLVED (Step 4): guided screen is framing only; recording is always C2's real recorder. No duplication. |

## Invariant check (Step 1)

- Real data: violated by mock capture + fixture memo (fixed in Steps 4–5).
- Calm progress: PASS — 2-dot cue only on intent (1/2) + start-song (2/2); no global stepper anywhere.
- One primary action per screen: PASS on all five.
- Non-dead-end skips: PASS ("Skip for now" x2, "Write lyrics instead", back buttons).
- Never-fake-success: PASS on StartFirstSong (retryable error, no silent demo drop); violated by mock capture (fixed).
- Roles via A2 ROLE_DISPLAY: no role UI in B2 screens; invite framing routes to B3/people layer.

## Cross-lane handoffs

- **Lovable (backend):** add `referral_program_seen` to onboarding-set-step STEPS
  enum; add automatic `completed` advancement (suggest: trigger when
  first_collaborator_invited is reached, or on Nth return session).
- **A1:** OnboardingProgress uses hardcoded #B5935A — migrate primitive to tokens.
- **C1/C2:** if a first-visit guided hint inside CaptureScene is ever wanted,
  consume a `?first=1` flag there; B2 no longer emits it.
- **C2 (optional polish):** an `onMemoSaved` callback / navigation hook from
  CaptureScene would let the first real save land on /songs/:id/voice-added
  automatically. Today the celebration is reachable via the guided lane and by
  direct navigation; the step still advances via the DB trigger regardless.
