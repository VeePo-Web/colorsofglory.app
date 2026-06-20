# C4 — CLAUDE: Voice-Memo List + Playback
## Cluster 5 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. Voice memos are first-class content — the list + player must feel
> as good as the capture mic. Mobile-first; tokens only; seam only; meet
> `MOBILE-UX-BENCHMARK.md`.

## YOUR ROLE
Claude: all `src/` UI. Seam only; no schema/auth/tests. `docs/BUILD-PATHWAY.md`.

## CONTEXT
Recordings need a beautiful home: the song's voice-memo layer (`/songs/:id/canvas?layer=
voice` today) and the memo cards in the room/canvas. Existing pieces to reuse/upgrade:
`src/components/canvas/VoiceMemoCard.tsx`, `src/components/voice/*` (RecordingWaveform,
players), the **on-brand `ReviewAudioPlayer`** built in capture. Spec: Feature 10 (Voice
Memo Cards + Waveforms), reference image `download (17).webp` (saved memo with waveform).
Data via L5's seam (memos + takes + waveform + signed URL + transcript + key/BPM + states).

## OBJECTIVE
A calm, fast voice-memo list where each memo is a gold-grade card with a real waveform,
one-tap playback, layered-take support, transcript peek, and clear processing states —
playable while scrolling, never a default browser player.

## PHASE 0 — SPEC
Read F10 + `download (17).webp`. The one moment: *tap a memo, it plays instantly with a
moving waveform; the songwriter hears the idea again in under a second.*

## PHASE 2 — AUDIT (7 lenses)
Audit `VoiceMemoCard` + the voice layer vs the mockup + benchmark: waveform render cost,
playback latency, layered takes, processing/enhancement/transcribe states, tap targets,
empty state, reduced-motion.

## PHASE 4 — BUILD
1. **Memo card:** name, duration, contributor color, **waveform** (from L5 peaks — no
   full-file decode), section tag, relative time. Gold-grade, ≥44px controls.
2. **Playback:** reuse/extend `ReviewAudioPlayer` (gold play/scrubber); instant start;
   one memo plays at a time; optional persistent mini-player while scrolling.
3. **Layered takes (F16):** if a memo has layers, show them and play together; a clear
   "record over this" affordance (tap-to-record, consistent gesture).
4. **Intelligence surfacing:** show transcript peek (lyrics), detected key/BPM/chords when
   ready; show calm "enhancing… / transcribing…" states (LX) — never a spinner wall.
5. **List:** chronological/section grouping; swipe or menu actions (rename, delete→soft,
   restore); designed empty state ("Your first hum will live here").
6. Mobile-first polish: tokens, motion, reduced-motion, 44×44, no layout shift on load.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: play, layered take, transcript-pending,
empty, offline. Evidence + a mobile re-drive (waveform moves, latency < ~300ms perceived).

## ACCEPTANCE CRITERIA
- [ ] Each memo: real waveform (no full-file decode), one-tap instant playback, ≥44px.
- [ ] Layered takes play together; "record over" uses the tap gesture.
- [ ] Transcript/key/BPM surfaced with calm pending states; no default `<audio>`.
- [ ] Empty + offline states designed; meets the mobile benchmark; ≤250 lines/component.

## DEPENDENCIES
- **L5** (memos/takes/waveform/signed URL seam) · **LX** (transcript, key/BPM, states).
  Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/voice-memo-list` → merge → delete.

## REFERENCES
- `src/components/canvas/VoiceMemoCard.tsx`, `src/components/voice/*`, `src/components/capture/ReviewAudioPlayer.tsx`
- F10 PDF + `download (17).webp`
- `docs/prompts/L5-…voice-memo-storage-analysis.md`, `MOBILE-UX-BENCHMARK.md`, `BUILD-PATHWAY.md`
