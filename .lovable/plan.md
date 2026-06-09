# Card Detail — Auto-Beautiful Output

The promise: in Capture, the user dumps everything (voice memo, lyrics, chords, scripture, notes) into a section with zero organization effort. When they open that same section card on Canvas, it renders as a **museum-grade, perfectly typeset section sheet** — title, key/BPM, chord-over-lyric layout, embedded waveform, scripture cards, notes — all auto-arranged. This plan covers the rendering surface (`CardDetailSheet`) plus the backend + AI layout pass that makes raw input look intentional.

## What "amazing output" means visually

A single scroll-snapped sheet, cream + gold, opens from the card:

```
┌───────────────────────────────────────────────┐
│  ‹ Canvas              ⋯ menu    [Capture →] │
│                                               │
│  Verse 1                       ● working      │  ← serif 32px, status dot
│  Key G · 72 BPM · 0:48 · 3 takes              │  ← muted meta line
│                                               │
│  ▶ ▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭ 0:18 / 0:48                │  ← gold waveform player, the selected take
│  Takes: ● Take 3 (today)  ○ Take 2  ○ Take 1  │  ← tap dots to swap
│                                               │
│  ───────────  LYRICS  ───────────             │  ← serif divider with eyebrow
│                                               │
│        G                D/F#                  │  ← chord chips floating above
│   Holy is the Lord our God                    │
│        Em              C                      │
│   The whole earth is full of His glory        │
│                                               │
│  ───────────  SCRIPTURE  ───────────          │
│  ┌───────────────────────────────────┐        │
│  │ Isaiah 6:3                        │        │  ← gold-bordered card
│  │ "Holy, holy, holy is the LORD…"   │        │
│  └───────────────────────────────────┘        │
│                                               │
│  ───────────  NOTES  ───────────              │
│  • try a half-time feel under line 2          │
│  • Sarah suggested capo 3                     │
│                                               │
│  ───────────  PEOPLE  ───────────             │
│  Parker · Sarah · Caleb (3 contributors)      │
│                                               │
│  ───────────  ACTIVITY  ───────────           │
│  · 2h ago — Take 3 added by Sarah             │
│  · yesterday — Chord change C→Cadd9           │
└───────────────────────────────────────────────┘
```

Everything above is generated from messy capture input. No manual layout.

## How frictionless input → beautiful output works

### Input side (Capture, already shipped, no UI change)
User records and dictates freely. Whatever lands in the capture session — audio blob, raw transcript, typed chord chips, scripture picks, scratch notes — is sent to `commit-capture` with `target_card_id`.

### Server-side beautification (new) — single edge function `format-card-content`

Triggered after every `commit-capture` write for that card (or manually from the sheet via "Re-tidy"). Does this in one call to Lovable AI Gateway (Gemini Flash) with **structured JSON output only** (no raw prose echoed back):

Input to the model (sanitized — no PII, no model gets stored audio):
- `lyric_lines: string[]` (raw transcript lines, after marker-stripping)
- `chord_events: [{ chord, ts_ms }]` (timestamps from typed dock taps)
- `take_duration_ms`
- `existing_key`, `existing_bpm` (if user set them)

Output JSON (strictly validated with Zod):
- `cleaned_lines: [{ text, chords: [{ chord, char_index }] }]` — chords mapped to character positions over each line using the timestamp ratio against the take duration.
- `suggested_key`, `suggested_bpm` — only when user hasn't set them; surfaced as a dismissible "Use suggested key G? ✓ ✗" chip, never auto-applied silently.
- `line_grouping: 'verse' | 'chorus' | 'bridge' | null` — confirms the kind only when high-confidence; never overrides user.
- Punctuation/capitalization normalized line-by-line (e.g. "holy is the lord our god" → "Holy is the Lord our God") with a per-line `original` kept in `card_activity` so the user can revert.

Privacy: payload sent to the gateway contains only lyric text and chord/bpm hints — no user id, no song id, no take audio. Per project memory, no raw lyric/transcript bytes are stored in `card_activity` or sent to analytics.

The result is written back as updated `card_lyrics` rows with chord_positions filled in, plus `section_cards.song_key/bpm` if user accepted a suggestion. An activity row `event_kind='formatted'` records the diff hash only.

### Manual override (frictionless edits, no "edit mode")
- Long-press a chord chip → swap/delete chord.
- Long-press a lyric line → quick actions: edit · split line · delete · revert to original.
- Drag a scripture/notes block to reorder (only within its own section — lyrics/chords/scripture/notes stay in fixed canonical order).
- Tap key/BPM badge → inline editor.

No "save" button anywhere. Every edit autosaves and writes one activity row.

## Component build (Claude lane, all new under `src/components/canvas/`)

`CardDetailSheet.tsx` — the parent sheet. Bottom-sheet at 92vh, drag-to-dismiss, scrim, scroll-snap sections. Imports the eight section blocks below in canonical order.

| Block | File | Renders |
|---|---|---|
| Header | `CardHeader.tsx` | Back chevron, title (inline-editable), kind chip, status dot toggle, ⋯ menu, gold "Open Capture →" CTA pinned bottom of sheet |
| Meta | `CardMetaRow.tsx` | `Key · BPM · duration · take count` — tap key/bpm opens inline picker |
| Player | `CardTakePlayer.tsx` | Selected take waveform + play/pause + scrubber + take dots row (reuses existing mini-player primitives) |
| Lyrics | `CardLyrics.tsx` | Chord-over-lyric layout using `chord_positions` JSON; each line wrapped in long-pressable row |
| Scripture | `CardScriptureBlock.tsx` | Gold-bordered cards from `card_attachments WHERE kind='scripture'` |
| Notes | `CardNotesBlock.tsx` | Bulleted list from `card_attachments WHERE kind='note'` |
| People | `CardPeopleRow.tsx` | Contributor avatars + count |
| Activity | `CardActivityList.tsx` | Last 10 `card_activity` rows, calm copy |

Plus `SectionDivider.tsx` — the eyebrow-label divider used between blocks.

### Empty-state handling (critical to "looks intentional")
Each block hides itself entirely when empty — no "no lyrics yet" placeholder noise. A first-time empty card shows only header + player + "Open Capture →" CTA, perfectly balanced. As content arrives via Capture, blocks fade-in with 30ms-staggered translateY.

### Loading / formatting state
While `format-card-content` is running (typically 1–2s after commit), the lyrics block shows a soft skeleton with a tiny gold pulse dot and the line "Tidying up…" in muted gray. Activity row added when complete.

## Backend additions (Lovable lane)

Append to `.lovable/plan.md`:

- **Edge fn `format-card-content`** — input `{card_id}`, reads raw `card_lyrics` + typed chord events for the latest take, calls Gemini Flash with sanitized JSON-only schema, writes back cleaned `card_lyrics` rows and (if `selected_take_id` is null) sets it to the most recent take. Returns `{updated: bool, suggestions:{key?, bpm?}}`.
- **Trigger**: `commit-capture` enqueues `format-card-content` after its own write succeeds (fire-and-forget via `pg_net` or direct invoke). On failure, raw content stays — never lose user input.
- **Zod schemas** for both directions live in `src/integrations/cog/cards.ts` so the client validates the response shape.
- **Per-line revert**: store original raw line in `card_activity.payload.original_lines` (text is acceptable here because it never leaves Postgres — distinct from the no-raw-to-AI rule).
- **SDK additions** in `src/integrations/cog/cards.ts`: `retidyCard(cardId)`, `revertLine(lyricId)`, `setKeyBpm(cardId, {key, bpm})`, `setSelectedTake(cardId, takeId)`.

## Reuse + tokens

- All colors via existing `--cog-*` tokens. No new colors.
- Chord chips reuse `--cog-gold-pale` background, `--cog-charcoal` text, mono font 12px.
- Dividers: 1px `--cog-cream-dark` with 12px uppercase tracked-100 `--cog-warm-gray` eyebrow label.
- Motion: section blocks animate in 400ms `--cog-ease-reveal`, 30ms stagger. Sheet open 600ms.

## Acceptance scenarios

1. **Messy in, clean out** From Canvas open empty Verse 1 → Capture → ramble lyrics + tap 4 chord chips at random moments → commit. Within ~2s the card sheet shows chord-over-lyric layout with chords at correct character positions, sentence-case capitalization, no marker words, take loaded in player.
2. **Suggestion chip** First commit with no key set → "Use suggested key G? ✓ ✗" chip appears once → tap ✓ → key badge updates, chip disappears, never re-shown for that card.
3. **Revert** Long-press a cleaned line → "Revert" → original raw text restored from activity payload, no AI re-run.
4. **Empty card** Tap an Ideas card with no content → sheet renders only header + "Open Capture →" CTA, balanced and quiet, no empty-state placeholder text in lyrics/scripture/notes/activity blocks.
5. **Privacy** Inspect `format-card-content` request payload → contains only lyric text + chord events + duration; no user_id, no song_id, no audio URL, no card_id (resolved server-side).
6. **Failure mode** Force AI gateway 5xx → raw content stays as-is, toast "Tidy unavailable · try again later", no data loss.
7. **Real-time** A second user open on the same card sees lyrics block re-render via Realtime subscription when formatter completes — no manual refresh.

## Out of scope

- Compare Mode (F21), Merge/Splice (F22), Line-level Suggestions (F19) — separate handoffs.
- PDF export of the card sheet.
- Auto chord detection from audio (Phase 4, needs different model).
- Editing existing Capture components beyond the already-spec'd bridge deltas.

## Deliverables this build turn

1. New handoff doc `docs/claude-handoffs/2026-06-08-card-detail-sheet.md` with the full component spec + AI tidy contract + acceptance scenarios.
2. Append "Card auto-format" backend section to `.lovable/plan.md` (edge fn + SDK additions + trigger).
3. No edits to `src/components/**`, `src/pages/**`, migrations, or edge functions in this turn (Claude UI build + Lovable backend build are separate following turns).
