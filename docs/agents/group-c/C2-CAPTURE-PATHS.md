# C2 · Capture Paths — Reconciliation & Decisions (Steps 7–8)

*C2 Capture Agent, 2026-07-08. The canonical map of how a captured fragment reaches a song, plus the decisions the charter left open.*

## The two live paths (+ one dead one)

### A — In-song big-mic (the golden moment)
`/songs/:id` or `/songs/:id/capture` → CaptureScene → tap → `useVoiceRecorder` + live STT → Stop → **Capture Outbox (`"intake"` uploader; durable-first as of Step 2)** → `intake-voice-memo` edge fn (memo + primary take) → ReviewSheet (server transcript, editable blocks) → `commitTakeToCanvas` (D-group) → CommitRibbon → canvas `?from=capture`.
- Typed fragments (side-rail sheet + mid-record pins) ride as PendingBlocks, sessionStorage-backed per song (Step 6), and commit with the take.
- Offline / failed first attempt → calm gold "Saved on this device" card; outbox auto-retries; a background sync graduates straight into review.

### B — Unfiled / global ("capture now, file later")
`/` (no songId) hums → `saveSeedIdea` (device-local: IndexedDB blob + localStorage index — durable-first by construction) → the **Seed Ideas shelf** (SongCatalogPage) + the capture scene's "Unfiled ·N" pill + Latest strip → `SeedIdeaCard` picker → `claimSeedIdea` → voiceApi pipeline into the chosen song. The rarely-shown global FAB (`GlobalCaptureFlow`) feeds the same shelf.
- **Product model (locked by the fleet, honored):** a global capture NEVER auto-creates a song — ideas go to the shelf; the songwriter chooses the song. Rail text tools on `/` guide into a real song instead (text can't persist without one).
- **Scope note:** seeds are device-local — they don't roam devices. Filed as the optional `seed_ideas` sync seam (C2-BACKEND-SEAMS.md §5).

### C — Legacy `idea_captures` client path: DEAD
`cog/capture.ts` (`quickCapture` / `listMyUnfiledCaptures` / `deleteCapture` / `promoteCapture`) has **zero UI callers** (grep-verified twice, Step 1 + Step 8) — superseded by Path B. Recommendation to A3: retire the client fns (or mark deprecated); the `promote-capture` edge fn can stay server-side if canvas promotion returns.

## Decisions

1. **`?first=1` — decided: no special-casing in capture.** No producer exists anywhere in `src` (grep-verified). Onboarding uses dedicated pages (`CaptureFirstIdeaPage` et al.) and lands users on bare `/`. Any future first-run overlay belongs to B2 (one owner); the scene's own self-teaching affordances (rotating prompt, nav-hint nudge, seed-count pill, ListeningPulse) already carry the first visit.
2. **Metronome re-scope (fleet, honored):** the capture-side `Metronome.tsx` UI was removed; the one-tap metronome (F14) now lives in the canvas lane (`useCanvasMetronome` → **consumes** C4's `lib/audio/metronome` engine — no fork anywhere). `ChordPicker` keeps TapTempo for BPM entry. The never-bleed concern is structurally moot in capture: no metronome UI exists on this surface, and recording rail-taps never open sheets.
3. **Rhyme tool:** `RhymeSchemer` was removed repo-wide by the fleet; CaptureSheet's lyrics verb keeps the syllable mirror. Not resurrected.
4. **Text-only fragments still require a take to commit** (`commitTakeToCanvas` needs `take_id`). Softened in Step 6 (sessionStorage persistence — nothing typed is ever lost) and guided on `/` (rail steers into a song). A future audio-less commit is a product call — filed, not built.

## Step 7 verification record (ChordPicker, manual entry)
First-run key prompt ("What key is this song in? We'll remember it."), KeyPicker + major/minor toggle, BPM input (20–300, 16px anti-zoom), TapTempo (rolling 6-tap window, 2s reset, 30–300 clamp, haptic), Letters⇄Numbers Nashville toggle, diatonic palette + borrowed chords, progression strip → QualityEditor (quality / extension / slash bass), save label `Chords · <tonic><m> · <bpm> BPM` — all verified present and consuming `lib/chords/nashville` + `keys` (no forks). F13 detection + song-level key/BPM persistence: filed in C2-BACKEND-SEAMS.md §§2, 4.
