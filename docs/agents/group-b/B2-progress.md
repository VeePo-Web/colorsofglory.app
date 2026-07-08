# B2 Onboarding Flow — Progress Log

## Step 1 — Arc mapped, punch-list locked
Audited the five screens, OnboardingProgress, the step machine
(inviteApi.updateOnboardingStep + ONBOARDING_STEP_ORDER), routeAfterAuth, and
App.tsx routes. Published docs/agents/group-b/B2-ONBOARDING-PUNCHLIST.md with
the full arc table, the three advancement mechanisms, every gap, and the
invariant check. Verified: all routes/steps confirmed against the real files.

## Step 2 — First Intent fork polished
FirstIntentPage: migrated all hardcoded hexes (#B5935A/#1A1A1A/#666/#999/#FFFFFF)
to A1 tokens (var(--cog-gold/-charcoal/-warm-gray/-muted/-cream-light),
var(--cog-border)). Two-card fork, quiet founder link, "You can always do both
later" microcopy, and intent_selected marking all preserved. No third option,
no Skip added. Verified: eslint + tsc clean.

## Step 3 — Start-First-Song migrated to A3 createSong()
Replaced the raw songs/song_members inserts with createSong() from
@/integrations/cog/songs (edge fn owns ownership/membership/quotas). Kept the
client-side profiles.first_song_id write (createSong doesn't set it; needed for
routeAfterAuth resume). Preserved the retryable inline error ("We couldn't
create your song just now…") and never-demo-"1"-on-failure guarantee. Demo
branch now guarded behind import.meta.env.DEV — in prod, no-session routes to
/auth/login. DECISION: `?first=1` removed — nothing consumed it and CapturePage
is C1/C2's lane; flagged in the punch-list. Palette migrated. Verified:
src/test/start-first-song.test.tsx rewritten for createSong (3 tests passing).

## Step 4 — First capture made REAL (two-capture problem resolved)
CaptureFirstIdeaPage no longer simulates recording (fake waveform/timer/Stop
removed — it persisted nothing, a fake-success violation). The guided framing
stays; the gold mic + "Record voice memo" now hand off into C2's REAL recorder
at /songs/:id. `first_idea_captured` now advances via the DB trigger on the
real voice_memo insert (source of truth) — no manual mark on a fake stop.
No duplication of C2. Verified: tsc + eslint clean; no MediaRecorder mock left.

## Step 5 — Voice-Memo-Added reads the REAL memo
VoiceMemoAddedPage: hardcoded fixture ("First melody idea", "0:12", fake
waveform) replaced with the user's real latest memo via A3's listMemosForSong;
real playback via getPlaybackUrl; waveform rendered from real waveform_peaks
(pale placeholder bars only when peaks aren't stored yet — never presented as
the audio). Step first_voice_memo_added is now marked ONLY when a real memo
exists (DB trigger remains source of truth). No-memo deep link shows honest
guidance back to the recorder — never a fake card. Added "Invite a
collaborator" secondary path (→ /songs/:id/people, B3's seam). Personalized
headline kept (songContext title, neutral fallback). Verified:
src/test/voice-memo-added.test.tsx (3 tests passing).

## Step 6 — Lyrics + invite entries (framing only)
"Add lyrics next" / "Write lyrics instead" land on /songs/:id/lyrics →
CanvasLayerRedirect(layer=lyrics) → C1's real lyrics surface;
first_lyrics_added advances off the real lyric insert (DB trigger). Invite
framing: quiet entry on the celebration screen; B3 owns send/token/accept and
already marks first_collaborator_invited in acceptInviteToken. Roles: no role
UI in B2 screens; role display stays with A2's ROLE_DISPLAY in B3 surfaces.
Seams documented in the punch-list.

## Step 7 — Progress + completion/dismiss
2-dot cue confirmed create-lane-only (intent 1/2, start-song 2/2); no global
stepper anywhere. Added the calm terminal dismiss ("I'll finish setting up
later") on VoiceMemoAddedPage → updateOnboardingStep("dismissed") → back into
the song; routeAfterAuth sends dismissed users to /home thereafter. Automatic
`completed` needs a backend trigger — HANDOFF to Lovable/A4 (documented).

## Step 8 — Continuity + no-dead-ends
Spine verified: intent → start-song (Back → intent) → real capture →
celebration (Back → /songs/:id) → song/lyrics/people. Every gate has a
non-dead-end skip; resume via routeAfterAuth drops mid-step users back INSIDE
/songs/:firstSongId. Fixed the celebration Back target from the stale
/songs/:id/capture to /songs/:id (both hit CapturePage; canonical path used).

## Step 9 — Real-at-launch + palette pass
Swept all five screens: no mock/fake data remains; demo-"1" is DEV-only;
?first=1 removed; hardcoded #FAFAF6/#B5935A/#1A1A1A/#666/#999 migrated to A1
tokens across all five screens (a concurrent lint/format pass also normalized
some gold alphas to --cog-gold-aXX vars — kept). OnboardingProgress primitive
still has #B5935A internally — A1's lane, flagged. Edge-fn missing
referral_program_seen flagged to Lovable (not edited). EarnPage confirmed real
(fetchReferralStats + profile referral_code) and distinct from F3's dashboard.

## Step 10 — Tests + end-to-end verify
- start-first-song.test.tsx: createSong success / retryable failure /
  DEV-only demo fallback — 3 passing.
- voice-memo-added.test.tsx: real memo render + step mark, never-fake-success
  empty state, invite + dismiss affordances — 3 passing.
- tsc --noEmit: clean. eslint on touched files: clean. Full vitest suite run
  recorded in B2-ONBOARDING-LAUNCH-READY.md.

## Cross-lane handoffs (open)
1. Lovable: add referral_program_seen to onboarding-set-step STEPS enum.
2. Lovable/A4: automatic `completed` advancement (no UI path can honestly
   claim journey completion today).
3. A1: tokenize OnboardingProgress internals (#B5935A → var(--cog-gold)).
4. C2 (optional): onMemoSaved hook so the first real save can auto-land on
   /songs/:id/voice-added.
