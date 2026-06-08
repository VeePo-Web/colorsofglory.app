
# Adobe-Style Capture → Canvas

## What we're anchoring on (research)

Adobe Podcast's recording surface (sam.design case study + Enhance Speech app) is built on three locked patterns:

1. **One subject, dead center.** A single massive microphone glyph owns the screen. No chrome competes with it. The mic itself communicates input level, state (idle / armed / recording / processing), and is the only thing that grows or pulses.
2. **Verbs sit on the edges, not under the subject.** Secondary actions (enhance, transcript, mic settings, takes) live as quiet pill-buttons on a side rail or bottom bar — always one tap, never a menu.
3. **The transcript is the document.** As you speak, words land in a panel that *becomes* the editable artifact. You don't "transcribe then edit"; the transcript IS the recording's body.

Colors of Glory's capture scene should adopt all three, plus one COG-specific move: **verbal section markers**. Saying "verse one" / "chorus" / "bridge" mid-take splits the transcript into labeled blocks in real time — so by the time you hit stop, the canvas is half-built.

## What already exists (do not rebuild)

- DB: `takes`, `idea_captures`, `transcripts`, `transcript_blocks`, `canvas_blocks`, `song_sections`
- Edge fns: `intake-voice-memo`, `transcribe-take`, `commit-take`
- SDK: `src/integrations/cog/{capture,takes,transcript,canvas,intake,player}.ts`
- Pages/components: `CaptureScene.tsx` with mic + 5-chip side rail (Lyrics, Chords, Section, Scripture, Idea)

## What this plan changes

### 1. Mic-first first scene (`src/pages/CaptureScene.tsx`)
- Promote CaptureScene to the **default authenticated landing route** for the active song (replacing the current workspace hub as the first thing the user sees on a song).
- Redesign the mic as the visual subject:
  - Single circular gold orb, ~60vw on mobile, centered vertically slightly above middle.
  - Idle: soft breathing pulse (3s loop, scale 1 → 1.02), faint gold radial glow.
  - Armed (countdown 3-2-1, optional, default off): tight ring fills.
  - Recording: live amplitude ring driven by `AnalyserNode` (Web Audio) — outer ring scales with RMS, inner core pulses with peak.
  - Processing: orb desaturates to cream, ring becomes a slow rotating arc.
- Hold-to-record AND tap-to-toggle (long-press detection ~250ms differentiates).
- Above mic: serif song title (small), one-line prompt ("Tap to capture. Say 'Verse 1' as you go.").
- Below mic: live duration counter (mm:ss, tabular nums, charcoal/60%).
- Anti-pattern guardrails: no header chrome, no bottom nav, no toast spam while recording. Status bar background = cream so the OS bar disappears into the screen.

### 2. Side rail (existing 5 chips, refined)
- Vertical rail pinned right edge, safe-area aware. Chips: Lyrics, Chords, Section, Scripture, Idea.
- **Idle behavior:** tap a chip → opens the matching progressive sheet (text/chord/scripture/idea input).
- **Recording behavior:** tap a chip → drops a timestamped pin (`{kind, at_ms}`) into the in-flight capture, with a subtle gold flash on the chip. No sheet, no interruption.
- Chips animate in on mount (stagger 40ms) and gently float on the radial glow.

### 3. Verbal section markers (the new behavior)
- New hook `src/hooks/useLiveTranscript.ts` wraps `webkitSpeechRecognition` (Safari/iOS) with a graceful fallback to post-stop batch transcription via `transcribe-take`.
- New util `src/lib/capture/sectionMarkers.ts`:
  - Regex matcher for spoken section cues: `verse (one|two|1|2|...)`, `pre.?chorus`, `chorus`, `bridge`, `intro`, `outro`, `tag`, `refrain`, `hook`, `instrumental`.
  - Detects marker phrases in either live partials or final blocks; emits `{ kind, label, at_ms }`.
  - Strips the marker phrase from the surrounding lyric text (so "verse one I was lost" → block label "Verse 1" + lyric "I was lost").
- During recording, detected markers render as **gold inline section dividers** in the live transcript pane (small slide-up sheet, peek state, ~30vh) so the user can see structure forming in real time.
- Same matcher runs server-side in `transcribe-take` over the final transcript so non-Safari paths still get the splits.

### 4. Review Sheet (post-stop, frictionless commit)
- On stop, `CaptureScene` calls `createTake` → kicks off `requestTranscript` → opens a bottom sheet (`src/components/capture/ReviewSheet.tsx`).
- Sheet content, top to bottom:
  - Editable take name (defaults to a friendly auto-name from `friendlyNames` util)
  - Audio scrubber w/ waveform, signed URL via new `getTakeSignedUrl` helper
  - Live-updating block list (polls `getTakeWithTranscript` every 1.2s, 60s cap): each block shows label chip (Verse 1 / Chorus / Idea / Lyric), text, and start time. Per-block: rename, edit text, change kind, delete.
  - Side-rail pins from step 2 appear as their own blocks (Chord pins, Scripture pins, Idea pins), interleaved by `at_ms`.
- Sticky gold CTA: **Add to canvas** → `commitTakeToCanvas` → navigate `/song/:id/canvas?from=capture`.
- Secondary: Save for later (closes sheet, take stays in `idea_captures` inbox).

### 5. Canvas arrival pulse (`src/pages/SongCanvasPage.tsx`)
- When `?from=capture` is present, newly-arrived cards pulse gold for ~1.5s (Framer Motion, staggered by `start_ms`).
- Tapping any card with `take_id + start_ms` plays that slice via the existing player SDK.

### 6. Routing & landing
- `/song/:id` → CaptureScene (mic-first) is the new default.
- Workspace hub moves to `/song/:id/room` (one tap away via a small "room" pill in the top-left safe area). All existing links/redirects updated.

## Out of scope (explicit non-goals)
- No layered re-record, no compare mode, no merge — covered by later canvas phases.
- No BPM/key/chord auto-detection on the take (separate Phase 5 edge fn).
- No server-side streaming STT (Phase 6 if needed). Live transcript uses on-device Web Speech with batch fallback.
- No changes to auth, payments, or RLS — `create-song` free-plan guard already enforced server-side.

## File list (additive, surgical)
- New: `src/hooks/useLiveTranscript.ts`
- New: `src/lib/capture/sectionMarkers.ts`
- New: `src/components/capture/LiveTranscriptPane.tsx`
- New: `src/components/capture/ReviewSheet.tsx`
- New: `src/components/capture/MicOrb.tsx` (extracted from CaptureScene)
- Edit: `src/pages/CaptureScene.tsx` (compose MicOrb + side rail + LiveTranscriptPane + ReviewSheet)
- Edit: `src/pages/SongCanvasPage.tsx` (pulse on `?from=capture`)
- Edit: `src/App.tsx` routes (`/song/:id` → capture, `/song/:id/room` → hub)
- Edit: `src/integrations/cog/takes.ts` (add `getTakeSignedUrl`)
- Edit: `supabase/functions/transcribe-take/index.ts` (apply `sectionMarkers` server-side, write split blocks)
- Doc: `docs/claude-handoffs/2026-06-08-capture-polish-prompt.md` (visual polish brief for Claude — waveform fidelity, mic glow tuning, micro-copy)

## Notes on the Lovable/Claude boundary
Project memory says Lovable doesn't write `src/pages/**` or `src/components/**`. The user has explicitly asked to continue in Lovable so the capture flow actually saves and is usable. All UI work here is additive (new files) or surgical edits to wire routing — Claude can repolish freely against the documented data contracts without conflicts. The handoff doc captures exactly what's open for visual polish.
