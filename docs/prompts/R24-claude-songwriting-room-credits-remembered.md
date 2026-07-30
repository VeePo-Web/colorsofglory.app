# R24 — Songwriting Room Audit: "Everyone's work is remembered"

**Lane:** Claude (frontend only). Backend shipped by Lovable.
**Goal of the room:** everything for this song stays connected here — including who made it.
**Rule:** simple over clever. Credits are a thank-you, not a scoreboard.

## Backend now available

SDK: `src/integrations/cog/credits.ts`

| Function | What it does |
|---|---|
| `getCreditsBoard(songId)` | ONE request → song title + dedication, your role, and every person with real contribution counts (`lyric_edits`, `takes`, `ideas`, `notes`, `chord_changes`), `first_contribution_at` / `last_contribution_at`, role, avatar, and their `credit_note`. |
| `setMemberCreditNote({ songId, memberUserId, creditNote })` | Owner only. Max 120 chars, null clears. Logged to activity. |
| `contributionTags(person)` | Pure helper → `["Owner","Lyrics","Voice memos"]` for the line under a name. |

Counts are derived from real work — never editable, never gamified.

## The screen `/song/:id/credits`

One scroll. Owner first, then collaborators, then viewers. No tabs.

### Person row
- Avatar (use `avatar_color` when there's no `avatar_url` — initial in cream on the colour).
- Serif name. Under it the `contributionTags(...)` line joined with ` · ` in warm gray.
- If `credit_note` exists it replaces the tag line and renders in charcoal italic — the human sentence wins over the derived one; tags move to a smaller third line.
- No numbers on the row. Counts live one tap deep.

### Tap a person
- Bottom sheet: their tags, "In the song since {joined_at}", "Last touched {last_contribution_at}", and the counts as a quiet 5-item grid.
- Owner only, at the bottom: a single text field "Credit line" (placeholder `Bridge melody`) → `setMemberCreditNote`. Save on blur, optimistic, no Save button.

### Header + export
- Serif `Credits`, then the dedication line if set (italic, centered, gold rule under it).
- One gold CTA at the bottom: **Export credits** → reuse `getSongExportPayload` + the existing text/PDF path from R14. Never a second network shape for the same data.

### Empty + edge
- Solo song: one row, tags `Owner · Lyrics · Voice memos`. Copy under it: "When someone joins, their work shows up here." No empty-state illustration.
- Viewer role: read-only, no fields, no disabled inputs.
- A person with zero contributions: tags read `Listening` — never "0 contributions".

## Performance
- One call on mount, rendered from cache first.
- `contributionTags` is pure; memoise rows by `user_id + credit_note + last_contribution_at`.
- The detail sheet uses data already in the board — zero extra requests.

## Definition of done
- Credits open in one request and read like a liner note, not a table.
- The owner can add a human credit line in one tap, saved without a button.
- Export reuses the R14 payload, no divergent second source of truth.
- Nothing on the screen implies competition between contributors.
