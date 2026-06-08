# Plan: Per-Song Brainstorm Folder — Worldclass Songwriting UX

A focused, personal songwriting workspace shipped tonight. "One song = one room of voice memos with notes underneath." Apple Voice Memos energy, COG visual language, songwriter mental model.

## UX principles applied

- **Capture-first.** The record button is the most visible thing on the page. Hold to record, release to save. Zero modals between thought and capture.
- **Idea as unit, not file.** Each memo is named like a thought ("Verse idea", "Chorus hook"), not a filename. Notes live with the audio that inspired them.
- **Calm, never noisy.** No badge counts, no "Take 1/Take 2", no delete (archive only). Friendly timestamps ("Sunday afternoon · 1 min 12 sec") instead of clocks.
- **One screen, one job.** No tabs. No nav. Just the brainstorm reel for this song.
- **Mobile-first 390px.** Thumb-reachable record button. Inline editing. Single-column.

## What gets built

### 1. Migration
- `voice_memos.notes text` — per-memo brainstorm note (nullable).

### 2. SDK — `src/integrations/cog/brainstorm.ts`
- `listSongMemos(song_id)` → memos with primary-take signed URL, friendly_name, duration_ms, notes, title, sorted newest-first; archived hidden by default
- `createMemo({ song_id, blob, mime, duration_ms, title? })` → uploads → inserts `voice_memos` + primary `takes` row
- `updateMemoTitle(memo_id, title)`, `updateMemoNotes(memo_id, notes)`
- `archiveMemo(memo_id)` / `unarchiveMemo(memo_id)`
- `getSignedAudioUrl(storage_path)`

### 3. Pages + components
- Keep auth as-is (already wired).
- **`/` Song Catalog** (replaces fly4me Index): cream background, serif title "Your songs", grid of song cards (title, last-activity friendly date, memo count, gold radial glow). FAB "+ New song" opens a small create dialog (title only; calls existing `create-song` edge function if available, else direct insert with default values).
- **`/song/:id/brainstorm` Brainstorm Reel** — the main event.

### 4. Brainstorm Reel UX

```text
┌────────────────────────────────────┐
│ ←  Title of Song            ⋯      │  serif title, back, menu
│    3 ideas captured                │  warm-gray subhead
│                                    │
│         ╭──────────────╮           │
│         │      ◉       │           │  big gold record button (96px)
│         │   tap or     │           │  pulse ring while recording
│         │     hold     │           │  timer shown live in center
│         ╰──────────────╯           │
│                                    │
│  ─────────  3 ideas  ─────────     │  warm divider
│                                    │
│  ▌Verse idea         Sun · 1m 12s  │  inline-editable title, friendly stamp
│  ▰▰▱▱▱  0:47 / 1:12          ▶    │  waveform scrubber + play
│  ┌──────────────────────────────┐  │
│  │ second line lands on G       │  │  autosave textarea (600ms debounce)
│  └──────────────────────────────┘  │
│                                ⋯   │  rename · archive
│                                    │
│  ▌Chorus hook        Sun · 47s     │
│  …                                 │
└────────────────────────────────────┘
```

- **Record interaction:** Tap to start (red dot + timer); tap again to stop and save. Hold for hold-to-record (release saves). Microphone permission requested on first tap with a friendly inline message.
- **Recording:** `MediaRecorder` (audio/webm;codecs=opus), 128kbps, peaks computed client-side from `AudioContext.decodeAudioData` into a 64-bin array, stored in `takes.waveform_peaks`.
- **Auto title:** First memo defaults to "First idea"; subsequent default to empty, placeholder shows "Name this idea" — keeps the brainstorm honest.
- **Playback:** Single shared `<audio>` element. Tap play on any memo = others pause. Scrubber shows progress; tap waveform to seek.
- **Notes:** Multiline textarea inline. Debounced autosave (600ms). Subtle "Saved" pulse when written.
- **Title edit:** Tap title → becomes input → Enter or blur saves.
- **`⋯` menu per memo:** Rename · Archive (no delete, per project rules).
- **Empty state:** Big gold record button + serif copy "Capture the first idea for this song" + warm-gray "Hold the button, hum the melody — we'll keep it safe."
- **Header `⋯`:** Show archived · Edit song title.

### 5. Routing
- `src/App.tsx`: replace any fly4me routes with `/` → `SongCatalog`, `/song/:id/brainstorm` → `Brainstorm`. Keep `/auth` + onboarding routes if present.

### 6. Visual tokens (locked, per project memory)
- Background `--cog-cream` (#F5F0E8), cards `--cog-cream-light` (#FAF7F2), text `--cog-charcoal`, gold accent `--cog-gold` (#B8953A) for record button + play affordances + active borders.
- Serif `Playfair Display` for song title and memo titles; `Inter` for body.
- Signature bottom-center radial gold glow on every brainstorm screen.
- Framer Motion: record button pulse ring; memo card entrance `translateY(8px)→0`, fade 400ms with `--cog-ease-reveal`; waveform bars animate height on playback.

### 7. Agent-boundary note
Memory says pages/components belong to Claude. This ships under `src/pages/SongCatalog.tsx`, `src/pages/Brainstorm.tsx`, `src/components/brainstorm/*` as a deliberate, self-contained surface so Claude can replace it later without untangling — already approved by the user for personal use.

## Out of scope (intentional)
- Multiple takes per memo (only primary shown; takes table still records it for later)
- Sections, chords, lyrics editor, collaborators, activity feed
- Capture bar / mini-player / share-sheet intake (already specced separately for Claude)
- Push notifications, transcription, version history

## Build order
1. Migration: `voice_memos.notes`
2. SDK: `brainstorm.ts`
3. Components: `RecordButton`, `MemoCard`, `Waveform`, `NewSongDialog`
4. Pages: `SongCatalog`, `Brainstorm`
5. Wire `src/App.tsx` routes
6. Smoke test on preview at mobile width, fix anything jagged.