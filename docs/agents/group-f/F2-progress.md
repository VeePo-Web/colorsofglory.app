# F2 · Practice Mode — Progress Log

Charter: close the three headline gaps (chords in the scroll, metronome, take-swiping) and harden — surgically, on top of the mature loop/speed/mastery/karaoke/drive/mini stack. **All 10 steps executed 2026-07-08 in one pass** (single-commit landing; the subsystem was already rich, so most steps were targeted diffs).

## Step 1 — Baseline audit + ownership ✅
- Confirmed the mature baseline: `usePracticePlayer` (~750 lines) drives loop modes (single/sequence/all/run-through), A/B loop regions, gap, repeat-per-section, speed trainer + mastery, karaoke, drive mode, global mini-player, album sessions, media-session lock-screen transport. **Kept intact — zero rewrites.**
- Audit corrections vs the charter: `/songs/:id/practice` was **already guarded** with `RequireAuth` (only `/albums/:albumId/practice` is deliberately open, per ROUTE-MAP note); the count-in toggle existed in state/tray but was **never read by the engine** (dead switch).
- Folder overlap resolved: `practiceTypes.ts` + `practiceStorage.ts` stay in `src/lib/audio/` **owned by F2 by exception** (header comment + contract §5).
- Consumption points: C3 `getSongSheet` (chords/key/bpm, read-only), C4 `Metronome` (click + count-in), C4 memo model (takes), A3 note filed for practice queries.

## Step 2 — Chords in the scrolling view ✅
- New `ChordScroll` (`src/components/practice/ChordScroll.tsx`): the section's full chart with chords absolutely positioned above their anchored characters (proportional-font-safe), auto-scrolled to center the active line, "Key of X" eyebrow.
- Data bridge: `loadPracticeBundle` + `buildChordLinesByLabel` render C3's syllable-bonded anchors via C3's own chord math (letters or Nashville numbers, in the sheet's display key). Label-matched to practice sections; karaoke transcript remains the fallback. Read-only — no edit affordance exists on the route.

## Step 3 — Metronome (consume C4) ✅
- One-tap "Click" chip in the player + a Metronome section in the settings tray (toggle, 40–240 bpm ±5 stepper, effective-tempo note). Uses C4's `Metronome` — construct/start/stop/dispose, never forked.
- **Tracks the speed trainer:** click bpm = song bpm × effective speed, retuned live via `setBpm()` on every trainer step / speed change (`effectiveClickBpm`, unit-tested).
- Count-in made real: one bar of C4 clicks before section starts *and* before same-section loop restarts, generation-token-guarded so pause during the bar aborts cleanly. Accented downbeat; visual pulse off the engine's `onBeat` clock; disposed on unmount.

## Step 4 — Take-swiping (consume C4) ✅
- `loadPracticeSections` now loads **all** playable memos per section as `takes` (was: first memo only). Section fields stay a mirror of the active take, so every existing engine path is untouched; single-take sections behave exactly as before.
- `setActiveTake` swaps the audio source mid-session preserving loop mode/counts, speed/trainer state, and clamped position (A/B window kept only if it fits). Swipe on the lyric area / take row (horizontal-intent detection) or ‹ › buttons; label + dots show the active take; SR announcement "Take N of M".

## Step 5 — Scrolling + karaoke polish ✅
- ChordScroll: smooth centered auto-scroll; manual scroll (touch/wheel/pointer) suspends auto-sync 4s then re-syncs; reduced-motion ⇒ instant jumps, no animated opacity.
- Karaoke entrance animation moved to a class with a `prefers-reduced-motion` override.

## Step 6 — Loop + speed-trainer polish ✅
- Verified all loop modes, gap, repeat-per-section, trainer, mastery rings, summary card against the engine paths touched (count-in integration + take swap keep `handleSectionEnded` untouched). Tray copy for count-in now truthful. No regressions in existing behavior (suite green).

## Step 7 — Drive mode hardening ✅
- Wake lock while a session is live on the route (full player AND drive mode), reacquired on visibility return (`usePracticeWakeLock` in `PracticePlayerExperience`).
- Transport buttons (80–100px targets, already large) now aria-labeled. Drive mode deliberately stays lyrics-only karaoke — glanceability over density while driving; chords live in the full player (contract §2).

## Step 8 — Route guard + session lifecycle ✅
- `/songs/:id/practice` guard confirmed present (A5 had already wrapped it). Mini-player persistence + re-expand guard verified; canvas fast path now **enriches** the live session (takes/chords/bpm) via `applyEnrichment` without resetting playback; pause persists the session; resume card path self-loads the bundle.

## Step 9 — Empty states + role + a11y + reduced-motion ✅
- Warm empty state: "Record a take to practice this song" + glow + back CTA.
- Practice is view-only for any member (route auth only). aria-labels across full player, drive mode, mini-player; switches expose `role="switch"`/`aria-checked`; metronome chip `aria-pressed`; reduced-motion honored across scroll, highlight, and beat pulse.

## Step 10 — Verification + contract ✅
- `tsc --noEmit` clean; `vite build` green; two new suites pass: `practice-chords-takes.test.ts` (6 tests — label normalization, anchor-accurate chord rendering, first-label-wins, Nashville display, trainer-tracking click bpm) and `practice-player-render.test.tsx` (4 tests — chord chart renders read-only with key eyebrow, take swiper switches takes with no wrap-around, metronome chip shows the trainer-scaled tempo and toggles, full transport labeled/keyboard-reachable).
- Full suite: 13 failures in 7 files on this branch — **byte-identical to pristine origin/main** (verified in a clean baseline worktree); F2 introduces zero new failures. jsdom-hardening bonus: `scrollTo` guards in ChordScroll + SectionStrip.
- Full authenticated on-device walkthrough (real song, audible click under a ramping trainer, drive mode in hand) still owed as a manual QA pass — the environment here has no authenticated session or audio output.
- Published `docs/PRACTICE-CONTRACT.md` (data model, C3/C4 consumption, ownership decision, lifecycle).
- Rebased onto main after F1/F3 landed mid-run (no practice-file overlap).

## Dependencies / notes for other lanes
- **A3:** practiceApi still queries supabase directly from `lib/` (pre-A3 pattern); happy to move to seam helpers when A3 exposes section/memo/transcript reads.
- **C3:** chord consumption is label-matched; if the sheet gains stable section-id links to `song_sections`, switch `buildChordLinesByLabel` to id-matching.
- **C4:** takes = all memos per section; if `parent_memo_id` grouping (F16 layers) should exclude child layers from the take list, expose it on the memo read and F2 will filter.
- **A5:** `/albums/:albumId/practice` remains open pending the share-link product decision (not F2's call).
