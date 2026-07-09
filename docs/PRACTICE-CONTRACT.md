# PRACTICE CONTRACT — F2 (Practice / Performance Mode)

**Route:** `/songs/:id/practice` (guarded by `RequireAuth`; `/albums/:albumId/practice` is deliberately unguarded pending the public album-share decision — see ROUTE-MAP).
**Owner:** F2. Last updated: 2026-07-08.

Practice READS the song to rehearse it. It never edits lyrics, chord positions, or section labels (C3's lane), never touches the canvas (D), and never forks C4's audio engines.

---

## 1. The practice data model

`loadPracticeBundle(songId)` (`src/lib/practice/practiceApi.ts`) is the one entry point:

```ts
PracticeBundle {
  sections: PracticeSection[];   // one per song section that has ≥1 playable memo
  bpm: number | null;            // C3 sheet meta tempo (null = song has no declared tempo)
  songKey: string | null;        // C3 sheet display key
}
```

`PracticeSection` (in `src/lib/audio/practiceTypes.ts`) carries, per section:

- **Active-take mirror** — `memoId` / `durationMs` / `lyrics` / `transcriptLines` always reflect the *active take*, so the caching/playback/karaoke engine paths are identical to the pre-takes era.
- **`takes?: PracticeTake[]`** — every playable memo on the section, oldest first (F15). Optional: canvas nav-state sections without it behave as single-take sections.
- **`activeTakeIndex?: number`** — which take the mirror reflects.
- **`chordLines?: PracticeChordLine[] | null`** — the section's lyric+chord chart from C3 (see §2).

`loadPracticeSections(songId)` remains as the sections-only loader; `loadAlbumPracticeSections` uses the bundle per song (namespaced ids), so album rehearsal gets chords too. Practice queries `song_sections` / `voice_memos` / `voice_memo_transcripts` directly from `lib/` (pre-A3 pattern); new practice queries should be filed with A3.

## 2. Chords consumed from C3 (read-only)

- Source: `getSongSheet(songId)` → `SheetDoc` (sections → lines → syllable-bonded `ChordAnchor`s, plus `key`/`mode`/`capo`/`bpm`/`display`).
- Bridge: `buildChordLinesByLabel(doc)` pre-renders each sheet section's lines to `{ text, chords: [{ glyph, at }] }`, with glyphs rendered by C3's own `chordToLetters`/`chordToNumbers` in the doc's display key and notation. **Practice never re-implements chord math and never writes the sheet.**
- Matching: sheet section ↔ practice section by **normalized label** (`normalizeSectionLabel`: trim/lowercase/collapse-whitespace). First sheet section with a label wins; unmatched practice sections fall back to the karaoke transcript view.
- Render: `ChordScroll` splits each line at anchor indices; each chord is absolutely positioned above its first character (proportional-font-safe). Scroll sync is **proportional** (position/duration → line index) because charts carry no timestamps; transcripts (which do) drive the karaoke view instead.
- Sheet load is best-effort: no sheet / fetch failure ⇒ practice runs without chords, never errors.

## 3. Metronome consumed from C4 (never forked)

- Engine: `Metronome` from `src/lib/audio/metronome.ts` — the same engine Capture (C2) and the Canvas (D2) drive.
- Running click: one instance in `usePracticePlayer`; `toggleMetronome()` starts/stops it from a user gesture. It behaves like a physical metronome — independent of playback (pause the take, keep the click) — and is stopped on `endSession` and **disposed on unmount**.
- **Speed-trainer tracking:** the click always runs at `effectiveClickBpm = round(bpm × effectiveSpeed)` where effectiveSpeed is the trainer's `currentSpeed` when enabled, else `playbackSpeed`. A state-driven effect calls C4's glitch-free `setBpm()` live, so a 0.7×→0.8× trainer step retunes the very next click interval.
- Tempo source: sheet `bpm` (C3) → `state.bpm`; user-adjustable in the settings tray (40–240, ±5); defaults to 100 when the song declares none.
- Visual pulse: driven off the engine's own `onBeat` clock (`state.metronomeBeat`), accent styling on beat 0; `prefers-reduced-motion` disables the scale animation.
- Count-in: the tray's count-in toggle (previously a dead switch) now plays **one bar of C4 clicks** (a second `Metronome` instance in `countIn` mode) before a section starts *and* before each same-section loop restart, at the effective tempo. A generation token (`playGenRef`) aborts the pending start if the user pauses/moves during the bar; no-Web-Audio environments resolve immediately.

## 4. Takes consumed from C4's memo model (F15)

- A section's takes = **all playable memos attached to that section** (status `finalized|transcribed|ready`), oldest first, labeled by memo title or "Take N". The per-memo *versions* queue (`memo_takes`, `TakeMiniPlayer`) and the layered stack player (F16, `useStackPlayer`) are separate C4 surfaces — never merged into this.
- `setActiveTake(sectionIndex, takeIndex)` swaps the audio source mid-session while preserving **loop mode, loop counts, speed/trainer state, and playback position** (clamped into the new take; an A/B window is kept only if the new take is long enough). Paused stays paused; playing resumes playing. Superseded swaps are abandoned via the generation token.
- UI: swipe left/right on the lyric area or the take row (horizontal-intent detection so it never fights the chart scroll), or the ‹ › buttons; active take shown by label + dots. Single-take sections render no take UI and behave exactly as before.
- Non-active takes are cached lazily on first swap (pre-cache still covers each section's active take).

## 5. `src/lib/audio/practice*` ownership (F2×C4 folder overlap)

**Decision: own-by-exception.** `practiceTypes.ts` and `practiceStorage.ts` stay in `src/lib/audio/` (import-path stability across the engine, storage, canvas launch, and home resume card) but are **practice-domain files owned by F2**. C4 owns every other file in `src/lib/audio/`. Recorded in a header comment in `practiceTypes.ts`.

## 6. Session lifecycle & hardening

- Mini-player (`MiniPracticePlayer`, mounted globally in `App` under `PracticePlayerProvider`) persists the live session across navigation; expanding re-enters the route without re-init (`state.songId === songId && status !== "idle"` guard).
- Canvas fast path: nav-state sections start instantly, then `applyEnrichment` merges the full bundle (takes/chords/bpm/key) **without disturbing active playback** — takes are only grafted onto sections that have none.
- `pause()` persists the session (localStorage, 24h TTL); resume card + deep links self-load via the bundle.
- Wake lock: the screen stays awake while a session is live on the practice route (full player and drive mode), reacquired on tab return. Best-effort.
- Empty state: no practicable sections ⇒ "Record a take to practice this song" with a path back.
- Roles: practice is view-only; any song member may practice (route-level auth only, per E1).
- A11y: all transport/settings/take controls are labeled; toggles use `switch`/`aria-pressed`; take changes announce politely; `prefers-reduced-motion` honored across karaoke entrance, chart auto-scroll (instant jumps), and the beat pulse.
