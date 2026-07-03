# Capture / Brainstorm Mode — Top 20 Features Deep Audit & Roadmap

Date: 2026-07-02
Lane: Capture (frontend-only, COG tokens, mobile-web first)
Sources: the three prior research docs (world-class benchmark, microinteraction, post-save lifecycle) + songwriter-engineer expertise. Grounds every item in: *does this help a real songwriter catch and grow an idea, instantly, on a phone?*

## The North Star
Tap the gold mic → sing/hum/speak → tap stop → the idea is **instantly safe, playable, warmly named, and one calm choice away from its home** — either *this song* or the general **Ideas** shelf — with lyrics, notes, and chords one tap away as quiet side rails, never a DAW. Reliability is the feature; the surface vanishes behind the spark.

---

## THE ROUTING MODEL (the user's core vision) — "one idea, two homes"

After a take is captured, the songwriter makes exactly **one** low-stakes decision, and never before recording:

```
                 ┌── This song ─────► filed into the current/chosen song room,
   [ take saved ]│                    optionally to a section (Verse/Chorus/…)
   (safe locally)│
                 └── Ideas ──────────► the general Ideas shelf (unfiled), a calm
                                       grid of sparks to browse + file into a song later
```

Design laws for routing:
- **Capture never asks for a home before recording.** The idea is caught first, filed second (benchmark rule).
- **Ideas is the default for global capture; This song is the default inside a song.** The choice is a single segmented control in review, pre-selected to the obvious default.
- **Filing later is first-class.** The Ideas shelf supports "→ Add to a song" per card and light batch-filing — organize *after* the creative moment, never during.
- **Filing is non-destructive + keeps lineage** — the original take, its contributor, timestamp, and credit follow it into the song (Canvas lane already models this for the tree).
- **Today's state:** global capture already lands in Seed Ideas (`seedIdeaApi` + `claimSeedIdea`), and in-song capture files to the song. The gap is the **explicit, visible destination choice in review** + a **beautiful Ideas shelf**. That is the #1 build.

---

## THE TOP 20 (ranked by songwriter value × frontend-feasibility, in lane)

Legend — Effort: S (hours), M (day-ish), L (multi-pass). Status vs current build.

### Tier 1 — the core loop must be perfect (build first)
1. **One-tap record, zero pre-record decisions** — *done.* Keep sacred; never regress.
2. **Local-first, unloseable take (record/layer/import + recovery sweep)** — *done* (pendingUploads spine).
3. **Instant local playback (even mid-upload/offline)** — *done* this session.
4. **Post-record destination choice — This song / Ideas** — **BUILD NEXT.** Segmented control in review, default-selected. S–M. *The routing vision.*
5. **The Ideas shelf** — a calm cream grid of unfiled sparks: play, rename, "→ Add to a song", discard; newest first; time-grouped. M. *Partially exists as data (`listSeedIdeas`); needs the world-class surface.*
6. **Warm, songwriting default names** — *done* this session (`defaultCaptureName`).
7. **Pastoral, never-technical recovery copy on every failure path** — *mostly done*; keep sweeping.

### Tier 2 — the trust + review layer
8. **"Saved on this device" + connection-aware sync states** — *done* (card copy + outbox pill).
9. **Review starts with listening, not AI** — playable local audio + duration + rough title first; intelligence arrives progressively and **never blocks playback**. S UI, needs job-status surface.
10. **Progressive intelligence chips** — calm pending states "Listening back… / Finding sections… / Finding key…" that fill in; low-confidence hidden or softly phrased. M (partly backend-gated).
11. **Section markers during recording (one-tap, non-modal)** — drop a timestamped Verse/Chorus cue without leaving the mic; edit later in review. M. *Side rail exists; make it marker-grade.*
12. **Rename-anytime, everywhere** — the name is never locked; tap to edit on card, review, shelf. S.
13. **Trim head/tail (conservative, non-destructive)** — a gentle "tighten the ends" that never touches the original; internal silence stays (it's musical). M.

### Tier 3 — the invisible studio (outcome, never controls)
14. **`COG Clean` derivative playback** — a "Cleaner playback ready" badge; music-safe for singing/instruments, speech-safe for notes; **original always one tap away**. L (backend-gated; UI = a toggle + badge).
15. **Capture profile (music vs speech), automatic** — inferred, not a pre-record picker; drives Clean + transcription behavior. M.
16. **Import existing audio / Voice Memos** — a first-class migration path, same local-first + retain+retry as a recording. S–M (dropzone exists; adopt the spine — the last save path).

### Tier 4 — memory & continuation (song-native)
17. **Searchable capture memory** — later search across lyric/transcript, section, key, BPM, chord, scripture, contributor. L.
18. **"Make it a song" from an Idea** — one tap turns a shelf spark into a real song room starting point (hand off to Canvas/Sheet). M (cross-lane handoff; capture emits, others build).
19. **Layered "record over this" from a memo card** — stack a harmony over a base take from anywhere memos live. M (Canvas has stacks; extend the entry point).

### Tier 5 — the side rails (the other capture surfaces, visual UX)
20. **Lyrics · Notes · Chords as calm side rails on the capture page** — see the dedicated section below. M per rail.

---

## SIDE FEATURES — visual UI/UX on the capture page (lyrics, notes, chords)

The capture page is *singing-first*. The side features are **quiet rails**, never competing with the mic. Principles:

- **The mic owns the center.** Everything else is a peripheral affordance: a small labeled chip/tab that *expands into a bottom sheet*, never a permanent panel crowding the mic.
- **One-tap in, one-tap out.** Tapping "Lyrics" slides up a focused writing sheet (16px inputs, autocorrect-off — already the standard); dismiss returns you to the mic instantly. The keyboard never appears on the default capture view.
- **Visual language:** cream surfaces, a small gold-outlined chip per rail with a Lucide glyph (FileText=Lyrics, StickyNote=Notes, Music=Chords), 44px targets, the signature radial glow behind the mic. Serif for any title.
- **Lyrics rail:** a distraction-free textarea (iA-Writer-calm), autocorrect off (a lyric is not prose), section-aware later. Draft persists locally instantly.
- **Notes rail:** free-form thoughts/prayer/scripture; same calm sheet; never "meeting notes" styling.
- **Chords rail:** the existing `ChordPicker` (key/BPM/chords) as a light sheet — suggestions, not an engineer's dashboard; BPM field already 16px (no iOS zoom).
- **Coherence:** all three rails share `CaptureSheetShell` chrome (scrim/handle/reduced-motion), so they feel like one system and inherit every a11y/mobile fix already shipped.
- **Anti-patterns (reject):** a permanent multi-panel dashboard, tiny <44px tabs, panels that push the mic off-screen, any rail that opens a modal while recording, raw browser inputs.

---

## PERFORMANCE BAR (every item)
- Tap→record < 400ms; stop→visible card < 800ms; tap→playback < 200ms (local blob → objectURL, zero network on the hot path).
- Meters/waveforms on rAF, never React re-render; transforms GPU-only; reduced-motion honored on every animation.
- No sub-16px inputs (iOS zoom); 44px targets; scoped `<style>` selectors.

## BUILD ORDER (next fires, in lane, frontend-first)
1. **#4 Destination choice (This song / Ideas)** in review — the routing vision. ← next
2. **#5 The Ideas shelf** — the beautiful home for sparks.
3. **#16 Import retain+retry** — closes the last unprotected save path.
4. **#9/#10 Review-starts-with-listening + progressive chips** (UI now, data as jobs land).
5. **#20 Side rails on `CaptureSheetShell`** — lyrics/notes/chords as calm sheets.

Each ships: pull → build the top in-lane slice → `tsc`/tests green → push straight to `main`.
