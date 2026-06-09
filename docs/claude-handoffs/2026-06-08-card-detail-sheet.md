# Card Detail Sheet — Auto-Beautiful Output

**Owner:** Claude (UI) + Lovable (backend tidy fn)
**Scope:** `src/components/canvas/Card*.tsx`, `src/integrations/cog/cards.ts` (SDK only), new edge fn `format-card-content`.
**Out of scope:** Capture internals, Compare/Merge/Suggestions, PDF export, audio-derived chord detection.

## Promise

In Capture the user dumps everything (voice memo, dictated lyrics, tapped chord chips, scripture picks, scratch notes) into a section with **zero organization effort**. Opening that same section card on Canvas renders a museum-grade, perfectly typeset section sheet — title, key/BPM, chord-over-lyric layout, embedded waveform, scripture cards, notes, people, activity — all auto-arranged from messy input.

## Visual target

```
┌───────────────────────────────────────────────┐
│  ‹ Canvas              ⋯ menu    [Capture →] │
│                                               │
│  Verse 1                       ● working      │  serif 32px Playfair, status dot
│  Key G · 72 BPM · 0:48 · 3 takes              │  --cog-warm-gray meta
│                                               │
│  ▶ ▬▬▬▬▬▬▭▭▭▭▭▭▭▭▭ 0:18 / 0:48                │  gold waveform, selected take
│  Takes: ● Take 3 (today)  ○ Take 2  ○ Take 1  │
│                                               │
│  ───────────  LYRICS  ───────────             │
│        G                D/F#                  │
│   Holy is the Lord our God                    │
│        Em              C                      │
│   The whole earth is full of His glory        │
│                                               │
│  ───────────  SCRIPTURE  ───────────          │
│  ┌───────────────────────────────────┐        │
│  │ Isaiah 6:3                        │        │
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

Sheet = bottom-sheet 92vh, drag-to-dismiss, scrim `rgba(28,26,23,0.35)`, scroll-snap between blocks, radial `--cog-gold-glow` at bottom-center.

## Components (all new, `src/components/canvas/`)

| File | Renders | Notes |
|---|---|---|
| `CardDetailSheet.tsx` | Parent sheet, scrim, header bar, scroll container | Open 600ms `--cog-ease-reveal`. Realtime subscribe to `section_cards`, `card_lyrics`, `card_attachments`, `card_activity` for `card_id`. |
| `CardHeader.tsx` | Back chevron → Canvas, inline-editable title, kind chip, status dot toggle (idea/working/locked/final), ⋯ menu (Re-tidy · Rename · Change kind · Move to Final · Delete), bottom-pinned gold "Open Capture →" CTA | |
| `CardMetaRow.tsx` | `Key · BPM · duration · take count` | Tap key/bpm → inline picker. |
| `CardTakePlayer.tsx` | Selected take waveform, play/pause, scrubber, take dots row | Reuses mini-player primitives. |
| `CardLyrics.tsx` | Chord-over-lyric layout from `card_lyrics.chord_positions` JSON | Long-press line → edit/split/delete/revert. Long-press chord chip → swap/delete. |
| `CardScriptureBlock.tsx` | `card_attachments WHERE kind='scripture'` | Gold-bordered cards. Drag handle to reorder within block. |
| `CardNotesBlock.tsx` | `card_attachments WHERE kind='note'` | Bulleted list, tap inline-edit, swipe-left delete. |
| `CardPeopleRow.tsx` | Contributor avatars from distinct `card_activity.user_id` joined `profiles` | |
| `CardActivityList.tsx` | Last 10 `card_activity` rows | Calm copy. No raw text shown. |
| `SectionDivider.tsx` | Eyebrow-label divider | 1px `--cog-cream-dark`, 12px uppercase tracked-100 `--cog-warm-gray`. |

### Canonical block order (fixed)

Header → Meta → Player → Lyrics → Scripture → Notes → People → Activity. Within Scripture/Notes items reorder via drag handles; blocks themselves are locked so output always feels intentional.

### Empty-state rule

Each block hides itself entirely when empty. No placeholder noise. First-time empty card = only Header + "Open Capture →" CTA.

### Formatting (in-flight) state

While `format-card-content` runs (~1–2s), lyrics block shows soft skeleton + tiny gold pulse + "Tidying up…" in `--cog-muted`. On completion crossfade 250ms to formatted lyrics.

## Backend contract (Lovable lane)

### Edge function `format-card-content`

```
POST  body: { card_id: uuid }
auth:  verify_jwt = true, caller must be is_song_member for that card's song
```

Pipeline:
1. Load: latest take `duration_ms`, `card_lyrics` ordered by `line_position`, typed `chord_events` for that take from `idea_captures.payload.chord_events`.
2. Build sanitized AI payload (NO user_id, song_id, card_id, audio URL):
   ```ts
   {
     lyric_lines: string[],
     chord_events: { chord: string; ts_ms: number }[],
     take_duration_ms: number,
     existing_key: string | null,
     existing_bpm: number | null
   }
   ```
3. Call Lovable AI Gateway, `google/gemini-2.5-flash`, `Output.object` with Zod schema:
   ```ts
   {
     cleaned_lines: { text: string; chords: { chord: string; char_index: number }[] }[],
     suggested_key: string | null,
     suggested_bpm: number | null,
     line_grouping: 'verse'|'chorus'|'bridge'|null,
     confidence: number
   }
   ```
   System prompt enforces: sentence-case, strip filler ("uh","um"), strip marker words ("verse one","chorus"), preserve user wording, never invent lyrics, map chord timestamps to character index via `ts_ms / take_duration_ms` over cumulative line length.
4. Write back in one transaction:
   - Update `card_lyrics.text` + `chord_positions` per row.
   - Append `card_activity { event_kind:'formatted', payload:{ original_lines, diff_hash } }` — enables per-line revert without re-running AI.
   - Do NOT auto-apply `suggested_key/bpm`. Return them; UI surfaces one-shot chip per card (dismissal tracked in `section_cards.tidy_suggestions_dismissed jsonb`).
5. Response: `{ updated: boolean, suggestions: { key?: string; bpm?: number } | null }`.

Failure modes:
- 429/402 → raw content stays, `{ updated:false }`, UI toast, no data loss, no activity row.
- Schema validation failure → `card_activity { event_kind:'tidy_failed' }` with no payload.

### Trigger

`commit-capture` enqueues `format-card-content` after its own commit (fire-and-forget). Manual re-run via card ⋯ → "Re-tidy".

### Migration delta

```sql
ALTER TABLE public.section_cards
  ADD COLUMN IF NOT EXISTS tidy_suggestions_dismissed jsonb NOT NULL DEFAULT '{}'::jsonb;
```

### SDK additions — `src/integrations/cog/cards.ts`

```ts
retidyCard(cardId): Promise<{ updated: boolean; suggestions: { key?: string; bpm?: number } | null }>
revertLine(lyricId): Promise<void>
setKeyBpm(cardId, { key?, bpm? }): Promise<void>
setSelectedTake(cardId, takeId): Promise<void>
dismissSuggestion(cardId, kind: 'key'|'bpm'): Promise<void>
subscribeCard(cardId, onChange): RealtimeChannel
```

All return Zod-validated typed payloads.

## Privacy invariants

- AI payload contains only the four sanitized fields above.
- `card_activity.payload.original_lines` is text but stays in Postgres — never leaves DB, never sent to analytics, never sent to AI on re-tidy (re-tidy uses cleaned `card_lyrics.text` as input).
- Realtime channel scoped to `card_id`, authorized via existing RLS.

## Acceptance scenarios

1. **Messy in, clean out.** Empty Verse 1 → Capture → ramble lyrics + tap 4 chord chips at random moments → commit. Within ~2s sheet shows chord-over-lyric layout, sentence-case, no marker words, latest take loaded.
2. **Suggestion chip.** First commit with no key set → chip "Use suggested key G? ✓ ✗" appears once → tap ✓ → badge updates, chip never re-shown.
3. **Revert.** Long-press cleaned line → "Revert" → original raw text restored from `original_lines`, no AI re-run.
4. **Empty card.** Tap card with no content → only Header + "Open Capture →" CTA. Zero placeholder text.
5. **Privacy.** Inspect outbound request → only the four sanitized fields. No user_id, song_id, card_id, audio URL.
6. **Failure mode.** Gateway 5xx → raw content stays, toast, no data loss, no `formatted` activity row.
7. **Realtime.** Second collaborator viewing card sees lyrics crossfade when formatter completes — no refresh.
8. **Re-tidy.** ⋯ → "Re-tidy" → skeleton → formatted output. Confidence < 0.5 → no write, toast "Not enough to tidy yet".
9. **Canonical order locked.** Drag Scripture above Lyrics → soft bounce; only items within a block reorder.
10. **Status dot.** Tap cycles idea → working → locked → final → idea, writes activity, updates Canvas card color.

## Token reuse

- All colors via existing `--cog-*` tokens.
- Chord chips: `bg-[var(--cog-gold-pale)] text-[var(--cog-charcoal)]`, mono 12px.
- Dividers: 1px `--cog-cream-dark` + 12px uppercase eyebrow `--cog-warm-gray` tracked-100.
- Motion: blocks fade-in 400ms `--cog-ease-reveal`, 30ms stagger. Sheet open 600ms. Status dot 150ms `--cog-ease`.

## Deliverables sequence

1. **This turn (Lovable):** append `format-card-content` + `tidy_suggestions_dismissed` to `.lovable/plan.md`.
2. **Next Lovable turn:** migration + edge fn + SDK additions.
3. **Next Claude turn:** build the 10 components against the SDK contract.
4. **Codex turn:** stress-test formatter with 50 messy capture fixtures; measure p95 tidy latency.
