# Handoff — Canvas arrival pulse (`?from=capture`)

Date: 2026-06-08
Owner: Claude Code (frontend).

## What's already shipped
- `commitTakeToCanvas` writes `canvas_cards` rows and `ReviewSheet` navigates to
  `/songs/:id/canvas?from=capture` on success.
- Capture scene now has the Adobe-style vertical right rail + inline gold
  section dividers in the live transcript.

## What's missing
`SongCanvasExperience` (`src/components/canvas/SongCanvasExperience.tsx`) does
not currently read the `canvas_cards` table — it renders from the legacy
`canvasLoader` / mock data path. So cards committed from a capture take don't
appear and can't pulse.

## Build
1. Wire `SongCanvasExperience` to merge `listCanvasCards(songId)` results into
   the rendered card stream (treat them as a new "Capture" zone or merge by
   `section_kind`).
2. Read `?from=capture` via `useSearchParams`. For any card whose `created_at`
   is within the last 30s of arrival time, set a `data-pulse="1"` attribute.
3. Add a one-shot CSS animation:
   ```css
   [data-pulse="1"] {
     animation: cog-card-pulse 1500ms var(--cog-ease-reveal) both;
   }
   @keyframes cog-card-pulse {
     0%   { box-shadow: 0 0 0 0 rgba(184,149,58,0.45); }
     100% { box-shadow: 0 0 0 14px rgba(184,149,58,0); }
   }
   ```
4. Stagger by 60ms across cards using `style={{ animationDelay: `${idx*60}ms` }}`.

## Acceptance
- Record on `/capture`, say "verse one … chorus …", commit.
- Land on `/songs/:id/canvas?from=capture`, the freshly added cards visibly
  pulse gold once.