## What we're building

A new frictionless **Capture Scene** that becomes the first thing you see when you open Colors of Glory (and the first thing inside a brand-new song). It mirrors what you love about the Adobe Podcast iPhone experience: a giant warm mic in the center, an always-labeled side rail of songwriting tools, and a live transcript that auto-splits into Verse / Chorus / Bridge boxes when you say those words out loud — then commits onto the canvas through a Review sheet.

Reference: Adobe Podcast (podcast.adobe.com) — giant centered mic, ripple rings on record, real-time rolling transcript, auto speaker/section detection, click-word-to-scrub, friendly cream/round palette, no hidden tools.

---

## 1. Where it lives (context-aware, one screen)

One component, two contexts:

- **App home** (`/`, signed in): replaces today's Song Catalog as the default landing. Catalog moves to a "Songs" tab in the bottom dock. Captures here land in the **Unfiled** inbox.
- **New song** (`/songs/:id/capture`): same component, but bound to that song. Captures land in that song's room.

The mic, side rail, and transcript behavior are identical; only the header chip changes ("Unfiled" vs "Song: *Heart Wide Open*"). Hitting **+ New song** anywhere drops you straight into this scene.

Out of scope for this plan: changing the catalog page itself, billing gating, or any backend schema work. We reuse the existing `quickCapture`, `voice-memos`, `voice-memo-upload-url`, `voice-memo-finalize`, and `intake-voice-memo` plumbing already shipped.

---

## 2. The visual scene (mobile-first, 390px)

```text
┌────────────────────────────────────┐
│  ◀ Songs           Unfiled  ⋯      │  ← header
│                                    │
│                                    │
│            ╭──────────╮            │
│           ╱            ╲           │
│          │   🎙  HOLD   │  ← big gold mic, ~140px
│           ╲            ╱           │
│            ╰──────────╯            │
│        ◦ ripple on record ◦        │
│                                    │
│         00:00:00    ▁▂▃▅▃▂▁        │  ← timer + live waveform
│                                    │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐      │  ← side rail (always labeled)
│  │✍ │  │🎸 │  │📌 │  │📖 │  │💡 │      │   Lyrics Chords Section Scripture Idea
│  └──┘  └──┘  └──┘  └──┘  └──┘      │
│                                    │
│   ▸ Live transcript (rolling)      │
│   ┌─ Verse 1 ───────────────┐      │
│   │ "When the morning..."   │      │
│   └─────────────────────────┘      │
│   ┌─ Chorus ────────────────┐      │
│   │ "Oh oh oh..."           │      │
│   └─────────────────────────┘      │
└────────────────────────────────────┘
```

### Design tokens (locked)
- Background: `--cog-cream` + bottom-center `cog-glow`.
- Mic ring: `--cog-gold` filled, `--cog-cream-light` glyph, `border-radius: 999px`, 140×140 mobile / 200×200 tablet.
- Ripple: three expanding circles at gold-alpha (0.25 → 0), 1.4s loop, only while recording. Reduced-motion: static ring only.
- Timer: serif (`--font-display`), tabular-nums, `--cog-charcoal`, 36px. Goes `--cog-gold` while recording.
- Waveform: bars `--cog-gold`, 32px tall, scroll left.
- Transcript blocks: card style (`--cog-cream-light`, 16px radius, gold border when active), section-label eyebrow in gold uppercase, lyric body in serif.

### Mic behavior
- **Tap = start / tap = stop** (Adobe pattern) for long captures.
- **Hold = quick hum** capture: release ends the take immediately (matches our existing hum-capture pattern in `CaptureBar`).
- Both modes write to the same `takes` + `voice_memos` pipeline.

---

## 3. Side rail — always labeled, never icon-only

Five chips below the mic. Always-visible text labels (Adobe's "don't be subtle" rule). Tapping a chip during recording inserts a marker without stopping the take.

| Chip | While idle | While recording |
|---|---|---|
| **Lyrics** ✍ | Opens a typed lyric snippet sheet (auto-attached to current take when one starts) | Inserts a typed-lyric pin at the current timestamp |
| **Chords** 🎸 | Opens key/BPM/progression sheet | Pins chord chip at timestamp |
| **Section** 📌 | Opens a Verse/Pre/Chorus/Bridge/Tag picker (this is also what voice keywords trigger automatically) | Inserts an explicit section break at the current timestamp |
| **Scripture** 📖 | Opens `Book Ch:Vv` input | Pins a scripture reference at timestamp |
| **Note / Idea** 💡 | Free-text idea capture (no audio required) | Pins a note at timestamp |

All chip pins become entries on the take's timeline that the Review sheet turns into separate cards on the canvas.

---

## 4. Live transcript + voice-triggered section auto-split

This is the heart of the request: *"when you say 'verse 1' or 'chorus' the transcription auto-sorts it into boxes."*

### Two layers
1. **Live rolling text** (best-effort, partial transcript) — shown immediately as you speak, so it feels alive. Powered by a streaming STT model.
2. **Finalized transcript on save** — re-run on the uploaded file for higher accuracy, then reconciled with the live stream.

### Section keyword detection
Recognized trigger phrases (case-insensitive, position-insensitive, with light fuzzy match):
- "verse one / verse 1 / first verse"
- "verse two / verse 2 / second verse" (etc.)
- "pre chorus / pre-chorus"
- "chorus / hook"
- "bridge"
- "tag / outro / intro / interlude"

When detected, the transcript starts a **new card block** at that timestamp, labeled with the section. Explicit chip taps from the Section side button take priority over voice detection. Users can rename or merge blocks in the Review sheet.

The keyword pass is a tiny client-side regex on partial transcripts (instant), with a confirmation pass on the server transcript. We never send raw lyric text to third-party AI for analytics (memory rule respected — transcription itself uses Lovable AI Gateway).

### Tap-word-to-scrub
Every word carries an offset (ms). Tapping a word in any block seeks the take's audio. This survives into the Review sheet and onto the canvas card.

---

## 5. End-to-end flow

```text
Open app
   │
   ▼
Capture Scene (big mic)
   │  tap mic → start recording
   │    ├─ live waveform + timer
   │    ├─ live partial transcript scrolls
   │    ├─ voice "Chorus" → new block opens
   │    └─ user taps Lyrics/Chord/Scripture chips → timestamped pins
   │  tap mic → stop
   ▼
Uploading + finalizing  (existing voice-memo-upload-url + finalize)
   │
   ▼
Review sheet  (bottom sheet, 90vh, drag to dismiss)
   ├─ Friendly auto-name suggestion ("Sunrise hum — Jun 8")
   ├─ Section blocks list (rename / merge / split / delete)
   ├─ Per-block: lyric text, chord pins, scripture pins, notes
   ├─ Audio scrubber synced to transcript taps
   ├─ Destination picker: "Send to: [Song title ▾] or [New song]"
   └─ Primary CTA: "Add to canvas"   Secondary: "Save to Unfiled"
   │
   ▼
Canvas commit  (existing canvas + cards)
   ├─ Each section block becomes a CanvasCard (lyric + linked memo)
   ├─ Section header cards laid out in vertical zones (Verse, Chorus…)
   ├─ Chord pins → ChordCard children
   ├─ Scripture pins → NoteCard with scripture eyebrow
   └─ Toast: "Added to <Song> — view canvas" (deep link)
```

If the user is on the App home (no song context) and picks "New song" in the Review sheet, we call `create-song` first, then commit the cards into that song.

---

## 6. New files (frontend only — Claude territory)

```text
src/pages/CapturePage.tsx                       ← route /capture and /songs/:id/capture
src/components/capture/CaptureScene.tsx         ← main composition (mic, rail, transcript)
src/components/capture/BigMic.tsx               ← mic button, tap+hold, ripple, waveform
src/components/capture/SideRail.tsx             ← 5 labeled chips, idle vs recording modes
src/components/capture/LiveTranscript.tsx       ← rolling text + section card blocks
src/components/capture/TranscriptBlock.tsx      ← one section card (rename, merge, delete)
src/components/capture/ReviewSheet.tsx          ← post-record bottom sheet
src/components/capture/DestinationPicker.tsx    ← song dropdown + "New song"
src/lib/capture/sectionKeywords.ts              ← regex + matcher (pure fn, unit-testable)
src/lib/capture/transcriptModel.ts              ← TS types for blocks/pins/timestamps
src/lib/capture/useLiveTranscript.ts            ← hook wrapping STT stream
src/test/capture/sectionKeywords.test.ts        ← unit tests for the matcher
```

Edits:
- `src/App.tsx` — change `/` to render `CapturePage` (catalog still reachable via `/songs`), add `/songs/:id/capture` already exists, add `/capture` alias.
- `src/components/cog/BottomNav.tsx` — surface a "Songs" tab pointing at `/songs`.

No backend changes. Existing SDKs reused:
- `src/integrations/cog/capture.ts` (`quickCapture`)
- `src/integrations/cog/takes.ts` (`createTake`, `buildTakeStoragePath`)
- `src/integrations/cog/memos.ts` (`uploadVoiceMemo`)
- `src/integrations/cog/songs.ts` (`createSong`)
- Canvas commit uses existing `canvasLoader` patterns.

---

## 7. Live STT choice

Phase 1 (this build): **batch transcription on save** via Lovable AI Gateway (Gemini Flash audio, or an STT model exposed by Gateway). Live rolling text is **simulated optimistically** — we show "Listening…" + an amplitude ribbon during record, then reveal the finalized transcript when the file is processed (usually <5s for a 30s clip). This keeps Phase 1 simple and avoids any user-provided keys.

Phase 2 (follow-up, not in this plan): real streaming partials. When we wire ElevenLabs Scribe Realtime or a Gemini Live audio stream through the Gateway, `useLiveTranscript` swaps its source without UI changes.

Section keyword detection runs on whatever transcript is available — partial or final.

---

## 8. Accessibility & motion

- All chips have visible labels (Adobe's lesson).
- Mic is a button with `aria-pressed`, hold gesture exposes `aria-label="Hold to record"`.
- Reduced-motion: no ripple, no scroll-in for transcript blocks; just fades.
- Live region (`aria-live="polite"`) announces "Recording started", "Chorus marker added", "Saved to Unfiled".
- Keyboard: `Space` toggles mic when focused; `1–5` selects rail chips.

---

## 9. Build order

1. **Tokens + shell** — `CapturePage` + `CaptureScene` skeleton with mic placeholder, glow, header.
2. **BigMic** — tap/hold gestures, recording state, ripple, timer, waveform (wire `useVoiceRecorder`).
3. **SideRail** — 5 chips, idle sheets stubbed.
4. **Upload + finalize** — pipe blob through `uploadVoiceMemo`; show "Saving…" overlay.
5. **Batch transcription call** — new edge function call (or reuse `voice-memo-transcribe`) returning words + offsets.
6. **sectionKeywords matcher + LiveTranscript** — split words into blocks, render cards. Unit tests.
7. **ReviewSheet** — rename/merge/split blocks, destination picker, "Add to canvas" commit.
8. **Canvas commit** — translate blocks → CanvasCards; toast + deep link.
9. **Route swap** — make `/` the Capture Scene; move catalog under `/songs`; add bottom-nav "Songs".
10. **A11y + reduced-motion + mobile QA at 390px and 768px**.

---

## 10. Verification (live preview)

1. Sign in, land on `/` → see big mic + side rail + glow (not the catalog).
2. Tap mic → ripple + timer runs → say "Verse one… when the morning breaks… chorus… oh oh oh" → tap mic.
3. Review sheet opens with two blocks labeled **Verse 1** and **Chorus**, audio scrubber synced.
4. Rename "Verse 1" → "Opening", tap "Add to canvas" with "New song: Sunrise" → land on `/songs/:id/canvas` with two section zones and two lyric+memo cards.
5. Hard refresh canvas → cards persist.
6. Back to `/`, hold mic (don't release) → release after 3s → take saves to Unfiled, Review sheet opens.
7. Tap a transcript word in a block → audio scrubs to that ms.
8. Repeat with reduced-motion OS setting → no ripple, no slide-ins, content still renders.

---

## What this does not change

- Backend schema, RLS, edge functions, payments, storage rules — untouched. (Lovable territory.)
- The Song Workspace, canvas card components, lyrics editor, invite flow, onboarding screens, settings — untouched except for the route swap on `/`.
- No third-party SDK additions; STT goes through Lovable AI Gateway.
- Phone OTP, email templates, founder/admin flows — untouched.

Approve and I'll build it in the order above.
