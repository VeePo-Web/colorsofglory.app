# Voice Memo Stacking — Research + Design (spec of record)

*Codified 2026-07-22 from the stacking research briefing. Implementation
status lives in VOICE-MEMO-STACKING-progress.md.*

## §1 The headline: two features under one name

"Stacking" is two features COG half-built under one word, needing opposite
behavior:

- **TRIES (takes, F15)** — attempts at the SAME idea; one plays at a time;
  you keep the best (the "keeper"). DB-backed and solid (`takes` table,
  one enforced `is_primary`, friendly names, archive-not-delete, complete
  `cog/takes.ts`) — but the UI (TakesDrawer) was never built and
  `cog/player.ts` is types-only.
- **LAYERS (stack/overdub, F16 / Product 04 "Record over this")** — sounds
  that play TOGETHER over a base (harmony, hum, response). Frontend logic +
  UI exist (`stackModel.ts`, `useStackPlayer.ts`, `MemoStack.tsx`,
  `StackSheet.tsx`) — but parentage was **in-memory only**: no
  `voice_memos.parent_memo_id` column existed, the upload function silently
  dropped the `parent_memo_id` the seam was already sending, and every
  stack un-stacked into orphan memos on reload. It demoed fine — the most
  dangerous kind of bug. **Closed 2026-07-22.**

## §5 The recommended shape

A voice memo is a **"sound"**: it can carry tries (one keeper) and layers
(play together, per-layer volume/mute). ONE Memo Sheet with two labeled
sections replaces TakesDrawer + StackSheet. ONE global player plays a
single take or a synchronized stack. Layers are ONE level only.

## §6/§7 Resolved decisions (build to these; do not relitigate)

1. v1 = one unified Memo Sheet housing BOTH tries and layers.
2. "Loose sketch harmonies" positioning, but playback on a **Web Audio
   shared clock** (no audible drift); record latency compensated
   best-effort (`layer_offset_ms`), never sample-locked.
3. Quota counts kept/primary takes + committed layers; archived tries
   effectively free (backend policy ask).
4. Collaborator layers are additive + attributed (credits/activity);
   setting the keeper stays owner/creator-gated.
5. **No comping.** A/B = reuse F21 Compare Mode.
6. Layer-record monitoring is **never-bleed** like the metronome:
   headphones → monitor the base; speakers → do NOT play the base aloud
   (bleed/double) — warn, count-in, record dry.

## The two verbs — never confused

- **"Try again"** → a new TAKE (same idea, one keeper, F15).
- **"Record a layer"** → a new CHILD memo (`parent_memo_id`) that plays
  WITH the base, with its own volume + mute.
Never a single ambiguous "record over" button.

## Binding laws

Nothing is ever lost (archive-not-delete; orphans promote to base; flatten
never errors) · never-bleed · calm sketchbook, not a DAW (volume + mute +
solo is the ENTIRE mixer — no pan/FX/comping/timeline) · one level only ·
credits matter · tokens/seams/≤250-line components · offline-first.
