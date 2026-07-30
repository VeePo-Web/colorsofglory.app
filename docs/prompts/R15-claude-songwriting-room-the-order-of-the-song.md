# R15 — Songwriting Room Audit: "The Order of the Song"

**Goal of the room (unchanged):** everything for this song stays connected here.
**Rule for this pass:** arrangement is the most physical thing in the room. It must
feel like moving paper — instant, reversible, and impossible to get wrong.

## What the audit found

1. **Order was an accident of the array index.** Positions came from the client's
   `map((s, i) => i)` inside a whole-doc save. Two people rearranging, or one
   person on a slow connection, could interleave writes and produce an order
   neither of them chose — or duplicate positions.
2. **No stale-drag protection.** If a collaborator added a Bridge while you were
   dragging, your save silently deleted it (it wasn't in your array).
3. **No duplicate.** "Chorus again" — the single most common arrangement move in
   worship writing — required retyping the whole chorus.
4. **Reorder rode the lyric save path**, so a pure move rewrote lyric rows and
   bumped every `updated_at`, poisoning the R13 conflict baselines and the feed.

## What backend shipped

```ts
import { reorderSections, duplicateSection } from "@/integrations/cog/sheet";
```

- `reorderSections(songId, orderedIds)` — atomic, all-or-nothing. Returns
  `{ status: "saved" }` or `{ status: "stale", current_ids }` when the section set
  changed underneath. Touches only `position`; lyric rows and their conflict
  stamps are left alone.
- `duplicateSection(songId, sectionId, label?)` — copies label, lyrics and chord
  anchors, inserts directly after the original, shifts the rest down. Default
  label is `"<Label> (copy)"`.
- Both refuse with `view_only` / `song_locked` — reuse R10's wording.

## What to build

1. **Drag is optimistic and immediate.** Reorder local state on drop, fire the
   RPC. No spinner, no disabled list. On `stale`: refetch, reapply the person's
   move on the fresh list if all their ids still exist, retry once, and only then
   show one line — *"Someone changed the sections. Your order is back."*
2. **One handle, one gesture.** A grip on the section header only. Long-press on
   mobile (250ms) to lift, haptic tick on lift and on drop, `scale(1.02)` + the
   card shadow while lifted, everything else settles with the 250ms room ease.
   No multi-select, no nested drag, no drop zones drawn on screen.
3. **Duplicate lives in the section menu**, not the toolbar. Three items max:
   Duplicate, Rename, Remove. After duplicating, scroll the copy into view and
   focus its label for immediate rename — that is the whole point of the move.
4. **Reorder is not a lyric edit.** Do not run the R13 guarded save on a move.
   Do not emit a lyric event. The feed says "reordered the sections" once per
   settled drag (R11 grouping already collapses bursts).
5. **Undo, not confirm.** Removing or reordering shows a 6-second toast with
   "Undo" that calls `reorderSections` with the previous array. Never a dialog.

## Acceptance

- Drag verse 3 to the top on a slow connection: list moves instantly, order
  persists, refresh confirms; no lyric `updated_at` changed.
- Two browsers reorder simultaneously: one wins cleanly, the other reconciles
  without losing a section.
- Collaborator adds a section mid-drag → `stale` path, nothing lost.
- Duplicate a chorus with chords → copy carries chords, sits directly below,
  label focused and selected.
- Viewer sees no grip and no section menu.
