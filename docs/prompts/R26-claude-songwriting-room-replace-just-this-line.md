# R26 — Line-level suggestions: "Replace just this line"

**Audience:** Claude (frontend owner). Backend is shipped — no SQL, no edge functions.

## The one job
A co-writer reads your chorus and thinks *"that third line should be 'mercy' not 'kindness'."*
Today their only options are to edit your song or text you about it. Neither is right.
A suggestion is the smallest possible collaboration unit: **one line, one proposal, one tap to accept.**

Simple beats clever: no threads, no diff viewer, no review queue with filters. One card, two buttons.

## Data seam (already built)
`src/integrations/cog/suggestions.ts`

- `getSuggestionsBoard(songId)` → `{ role, open_count, suggestions[] }` in **one** request.
  Each suggestion carries `section_label`, `line_id`, `original_text`, `suggested_text`,
  `note`, author name/avatar and `is_mine`.
- `createLyricSuggestion({ sectionId, lineId, suggestedText, note })`
- `resolveLyricSuggestion(id, "accept" | "decline" | "withdraw")` → accepting swaps the
  line into the sheet server-side and keeps chord anchors attached (clamped to the new text).
- `byLine(suggestions)` → `Map<line_id, LyricSuggestion[]>` for painting markers in the sheet.

## Surface 1 — Suggesting, from inside the sheet
In `/song/:id/lyrics`, long-press (or tap the ⋯ affordance on hover) a lyric line:
- Sheet slides up: the original line shown in `--cog-warm-gray` at the top, non-editable.
- One textarea pre-filled with the original text, autofocused, caret at end.
- Optional single-line `Why?` field, placeholder `Optional — a word on why`.
- Gold CTA: `Suggest this line`. Ghost: `Cancel`.
- On submit: close immediately, optimistic gold dot on the line, one Sonner toast `Suggested`.
  No modal confirmation, no success screen.

**Owners suggesting on their own song:** hide the entry point. Owners just edit.
Show it only when `role === "collaborator"`.

## Surface 2 — The line marker
- A line with an open suggestion gets a **4px gold dot** in the left gutter — not a badge,
  not a count, not a colored background. Tapping the dot opens the review card for that line.
- Never highlight the line text itself. The sheet must stay readable as a song.

## Surface 3 — Review card (owner/collaborator)
Reachable from the dot, and as a calm strip at the top of the lyrics screen when
`open_count > 0`: `3 suggested lines` — tap to open the stack.

Each card (16px radius, `--cog-cream-light`, `--cog-border`):
```
  CHORUS                                    Sarah · 2h
  ─────────────────────────────────────────────────────
  your kindness leads me home        ← struck through, --cog-muted
  your mercy leads me home           ← serif, charcoal, the proposal
  “sings better on the high note”    ← note, --cog-warm-gray, italic
  ─────────────────────────────────────────────────────
  [ Use this line ]            Keep mine
```
- `Use this line` = gold filled. `Keep mine` = plain text button, no red, no destructive styling.
- Author viewing their own: single ghost button `Withdraw`.
- On resolve: the card collapses (height → 0, 250ms) and the next one rises into place.
  Update local state from the RPC return — **do not refetch the board**.
- Accepting must also patch the in-memory sheet doc for that `line_id` so the lyrics behind
  the card are already correct when the sheet is revealed.

## Empty & viewer states
- No open suggestions: the strip simply isn't rendered. No "0 suggestions" chrome.
- Viewers: they see gold dots and can read cards, but no buttons and no suggest affordance.

## Performance rules
- Suggestions load in the same tick as the sheet (one extra RPC, fired in parallel — never chained).
- Zero refetches after any write; use the returned payload.
- `byLine()` map is memoised on the suggestions array, not recomputed per line render.
- Cards animate with transform/opacity only.

## Copy discipline
`Suggest this line` · `Use this line` · `Keep mine` · `Withdraw` · `Suggested` ·
`3 suggested lines`. Banned: "pending", "review queue", "approve", "reject", "request changes".

## Done when
- A collaborator can propose a line in under three taps and never touches the song.
- Accepting swaps exactly one line, keeps chords in place, and needs no page reload.
- The lyrics sheet with zero suggestions looks byte-identical to how it looks today.