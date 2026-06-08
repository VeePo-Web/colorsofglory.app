## Where we are

The capture flow is shipped end-to-end: big mic → record → live web-speech transcript → review sheet → commit to canvas. What's missing to actually match the Adobe Podcast feel is three specific things. This plan is surgical — no scope creep.

## What's still off (vs. Adobe Podcast)

1. **Side rail is a horizontal grid under the mic.** Adobe puts secondary verbs on the *edge*, not below the subject. The mic should own center; the rail should hug the right edge.
2. **Section markers don't appear inline as you speak.** Today, saying "Verse 1" splits blocks in state, but the live transcript pane shows a flat list. We need a gold inline divider that slides in the moment a marker is detected — so the user *sees* structure forming.
3. **Canvas doesn't celebrate arrival.** After commit we navigate to `/songs/:id/canvas?from=capture`, but the new cards don't pulse. The user can't tell what just landed.

Everything else (BigMic ripple/amplitude, ReviewSheet polish, CaptureSheet per-kind copy, transcript hook, intake pipeline) is already in place and working.

## Changes

### 1. `SideRail.tsx` — vertical, right-edge, safe-area aware
Switch from a 5-column grid to a vertical floating rail pinned to the right side, vertically centered against the mic.

```text
┌────────────────────────────┐
│         [ title chip ]     │
│                            │
│                       ┌──┐ │
│                       │L │ │  Lyrics
│         ◯             ├──┤ │
│        MIC            │C │ │  Chords
│         ◯             ├──┤ │
│                       │S │ │  Section
│       0:14            ├──┤ │
│                       │📖│ │  Scripture
│                       ├──┤ │
│                       │💡│ │  Idea
│                       └──┘ │
└────────────────────────────┘
```

- Position: `fixed`, `right: max(12px, env(safe-area-inset-right))`, `top: 50%`, `translateY(-50%)`.
- Chip: 56px wide, icon + tiny label below, stacked vertically with 8px gap.
- Stagger entrance (40ms each) on mount.
- While recording: subtle gold outer ring + on tap, flash gold for 300ms (timestamped pin behavior unchanged).
- Update `CaptureScene.tsx` main layout to remove the rail from the flow (it becomes a fixed overlay), so the mic re-centers properly.

### 2. `LiveTranscript.tsx` — inline section dividers, live
Today blocks render as separate cards. Adobe-style: render them as one continuous transcript with **gold section dividers** between blocks, and when a new marker arrives during recording the divider slides in (Framer Motion, `translateY(-4px)` + opacity, 250ms `var(--cog-ease-reveal)`).

- Replace the per-block `<article>` cards with a single continuous transcript surface.
- Each `block.marker` (except the first "unlabeled" implicit one) renders as a divider row:
  ```
  ───── VERSE 1 ─────
  i was lost but now i'm found …
  ───── CHORUS ─────
  …
  ```
- Divider style: thin gold rule (1px, `rgba(184,149,58,0.40)`) with the uppercase label centered in a small cream pill.
- Use Framer `AnimatePresence` keyed on `marker.atMs` so each new marker animates in only once.
- Partial word at the tail keeps its gold cursor.

### 3. Canvas arrival pulse
In `SongCanvasExperience` (or its card renderer — to be located when building), read `?from=capture` from `useSearchParams`. For cards whose `created_at` is within the last ~30s, add a one-shot Framer animation: `boxShadow: 0 0 0 0 rgba(184,149,58,0.4) → 0 0 0 12px rgba(184,149,58,0)`, 1500ms, staggered by 60ms across cards.

If the canvas renderer doesn't expose per-card mount cleanly, add a lightweight `useCanvasArrivalPulse(songId)` hook that returns a `Set<cardId>` of recently-arrived ids and applies a `data-pulse` attribute the card CSS can pick up.

## Out of scope (still)
- No live server-side STT (Web Speech is good enough; batch on stop continues).
- No waveform scrubber redesign (native `<audio>` stays for now).
- No re-record, compare, merge.
- No BPM/key detection.

## Files

- Edit: `src/components/capture/SideRail.tsx` (vertical floating rail)
- Edit: `src/components/capture/CaptureScene.tsx` (remove rail from flow; it's now overlayed)
- Edit: `src/components/capture/LiveTranscript.tsx` (continuous transcript + animated dividers via Framer Motion)
- Edit: `src/components/canvas/SongCanvasExperience.tsx` (read `?from=capture`, pass pulse set down) + the card renderer (read `data-pulse`)
- Possibly new: `src/hooks/useCanvasArrivalPulse.ts` if the card renderer needs an indirection

## Verification

1. Open `/capture` on mobile viewport — mic centered, rail on the right edge, no horizontal row of chips below.
2. Tap mic, say "verse one this is the first line, chorus this is the hook" — divider rows for VERSE 1 and CHORUS slide in during recording.
3. Stop, hit "Add to canvas", land on `/songs/:id/canvas?from=capture` — new cards pulse gold for ~1.5s.
