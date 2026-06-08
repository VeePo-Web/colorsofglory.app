# Capture Scene — World-Class Phase 2

Scope: **only the Capture mode** (home scene + recording + review → canvas handoff). No catalog, workspace, auth, or backend changes.

## Research distilled (what we steal, what we beat)

| App | What we take | What we improve |
|---|---|---|
| **Suno** | Big centered action, dark→light radial focus, one-thumb composer, "Create" as home | Replace generic prompt with serif worship-tone copy; cream not black |
| **Adobe Podcast / Enhance** | Live transcript bloom under recorder, waveform = trust signal | Auto-segment into section cards instead of one long blob |
| **AudioPen** | Tap-to-record → instant cleaned text card | Per-field smart formatting (lyric/scripture/chord/idea) we already shipped |
| **Voicenotes** | "Speak anything, we organize" with chips for type | Always-visible Lyrics/Chords/Scripture/Idea dock that doubles as mid-take markers |
| **Otter** | Speaker/section labels mid-stream | Spoken markers ("verse one", "chorus") split takes into cards live |
| **Dubnote / Suonote** | Song-context capture, take stacks | Drag-reorder + merge section cards before commit |
| **Apple Voice Memos** | Hold mic, waveform, friendly names | Hold = 8s hum; tap = full idea; auto-named "Morning idea · Mon 7:42" |

## What's already in (do not re-do)
Cream scene, BigMic with tap/hold, SideRail dock, ReviewSheet with reorder/merge/delete, CommitRibbon, section keyword splitter + acoustic RMS splitter, dictation everywhere, ChordPicker, ScripturePicker, Web Speech + ElevenLabs fallback, takes/idea_captures backend + SDK.

## Phase 2 additions (this plan)

### 1. Idle scene — make the home unmistakable
- Single radial gold glow under mic; remove any other chrome.
- Rotating serif prompt above mic: time-of-day + day-of-week aware ("A quiet idea this morning?", "Sunday — what stirred today?", 6 variants).
- Tiny "Unfiled" pill top-left (tappable → destination picker). No nav bar.
- Latest-3 peek strip 96px tall, horizontally scrollable, only renders if user has ≥1 capture.

### 2. Recording scene — Adobe-grade live feedback
- BigMic pulses with **real RMS amplitude** (already have AnalyserNode) — ring radius reacts to volume, not a fake timer.
- Live partial transcript blooms in muted gold 24px above mic; on finalize fades to charcoal and slides into a forming section card.
- Spoken marker detection ("verse one", "chorus", "bridge", "pre", "tag", "hook") triggers a 600ms gold flash + haptic + new card boundary. Marker words stripped from card body.
- Acoustic silence ≥1.6s also creates a soft boundary (dotted divider, user can merge).
- Bottom dock buttons (Lyrics/Chords/Scripture/Idea) double as **mid-take typed markers** — tapping during recording inserts a typed section card of that kind at the current timestamp.

### 3. Quick-actions while recording
- Long-press mic = pause (ring dims, transcript freezes). Release = resume.
- Swipe mic down = stop + open review.
- Two-finger tap = scratch last 5s (Suno-style undo).

### 4. Review sheet — the canvas pre-stage
- Stack of section cards: auto-label (Verse 1, Chorus…), 32px waveform, transcript snippet, type chip (lyrics/chords/scripture/idea/hum).
- Per-card actions: rename, retype, reorder ▲▼, merge-up, split, delete, play.
- Destination chip at top: **Unfiled · This Song · New Song** (sheet picker).
- Primary CTA: **"Send to canvas →"** (gold, full-width).
- After commit: 1.5s gold ribbon "Saved to {Song} · Open canvas" — tap deep-links `/songs/:id/canvas?from=capture` with pulsing nodes for the new cards.

### 5. Friction-cutters
- First-run coach mark on mic only ("Tap to capture. Hold to hum.") — dismisses forever after first take.
- Permission denied → mic chip greys, tooltip "Enable mic in Settings", typed capture still works via dock.
- Offline → captures queue locally, ribbon says "Saved offline · will sync".
- Background tab → recording continues with title-bar dot indicator.

### 6. Canvas handoff contract
Capture commits write to `idea_captures` + `takes` (already exist) and emit section-card metadata. Canvas reads `?from=capture&capture_id=…` and animates those nodes in with a 1.2s gold pulse so user sees exactly what landed.

## Files

**Edit:**
- `src/components/capture/CaptureScene.tsx` — rotating prompt, peek strip mount, destination pill
- `src/components/capture/BigMic.tsx` — RMS-reactive ring, long-press pause, swipe-down stop, two-finger scratch
- `src/components/capture/SideRail.tsx` → rename `BottomDock.tsx`, add mid-take marker mode
- `src/components/capture/ReviewSheet.tsx` — destination chip, type chip per card, split action
- `src/lib/capture/sectionKeywords.ts` — extend vocab (pre, tag, hook, refrain, intro, outro)

**Create:**
- `src/components/capture/RotatingPrompt.tsx`
- `src/components/capture/LatestPeekStrip.tsx`
- `src/components/capture/DestinationPicker.tsx`
- `src/components/capture/CoachMark.tsx`
- `src/lib/capture/rmsReactive.ts` — shared analyser hook for mic ring + splits
- `src/lib/capture/scratchLast.ts` — drop last N seconds from take + transcript
- tests for marker vocab, scratch, destination routing

**Do not touch:** `src/integrations/cog/**`, any backend, migrations, edge functions, canvas internals (only the deep-link query param contract).

## Acceptance scenarios
1. Cold open → big mic + serif prompt + glow, no other chrome.
2. Tap mic, say "verse one, holy is the Lord, chorus, all glory" → review sheet shows 2 cards labeled Verse 1 + Chorus, marker words stripped.
3. Hold mic 6s hum → one card type=hum, no transcript, waveform only.
4. During recording tap Chords dock → typed Chord card inserted at current timestamp.
5. Two-finger tap mid-take → last 5s of audio + transcript removed, ring flashes.
6. Commit to "New Song" → ribbon → tap → lands in `/songs/:id/canvas` with new cards pulsing gold for 1.2s.
7. Mic permission denied → grey chip, dock still works for typed capture.
8. Returning user → peek strip shows last 3 captures, tap re-opens review sheet for that capture.

## Out of scope
Canvas internals, workspace, auth, catalog, backend, pricing, settings, anything outside `src/components/capture/**` + `src/lib/capture/**`.
