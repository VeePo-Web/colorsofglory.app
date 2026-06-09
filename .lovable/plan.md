# Canvas ⇄ Capture Integration — Build Prompt

This plan delivers a single source-of-truth handoff prompt that defines how **Canvas** (the 40,000-ft song view) and **Capture** (the focused recording surface) interlock. Output is one doc at `docs/claude-handoffs/2026-06-08-canvas-capture-bridge.md` plus a minimal backend contract in `.lovable/plan.md`. No UI code written this turn (Claude's lane).

## Mental model (must be embedded verbatim in the prompt)

- **Canvas = the song's map.** A 2D board of *Section Cards* (Intro, Verse 1, Pre-Chorus, Chorus, Bridge, Outro, Vamp, Tag, Hook, custom). Each card shows: label, key/BPM badge, transcript snippet, waveform thumbnail, take count, contributor avatars, status dot (idea / working / locked / final), last-activity timestamp. Cards arrange in two trees: **Ideas Tree** (left, unfiltered) and **Final Tree** (right, curated, drag-ordered for arrangement).
- **Capture = the section's room.** Opening Capture from a card scopes every recording, transcript line, chord, scripture, and note to **that one section_card_id**. Capture is the only way new audio/lyrics/chords enter a card.
- **Unfiled Capture** (no card context) writes to a virtual "Inbox" lane on the Canvas. User can drag inbox cards into the Ideas Tree later, or assign them to an existing card via the destination chip.

## Routing contract

- `/songs/:songId/canvas` — Canvas view.
- `/songs/:songId/canvas/c/:cardId/capture` — Capture scoped to that card. Replaces the standalone `/capture` route when entered from a card; back button returns to Canvas with that card highlighted.
- `/capture` — Unfiled capture (home tab). Commits land in Inbox.
- Deep-links after commit: `/songs/:songId/canvas?from=capture&capture_id=…&card_ids=…` — Canvas pulses those cards gold for 1.2s.

## Data contract (backend — Lovable owns)

New tables (full DDL + RLS in handoff doc):

- `section_cards` — `id, song_id, parent_card_id (nullable, for splice/merge), tree ('ideas'|'final'|'inbox'), label, kind (verse|chorus|bridge|pre|tag|hook|intro|outro|vamp|custom), position int, key text, bpm int, status (idea|working|locked|final), created_by, created_at, updated_at`. RLS via `is_song_member`.
- `card_lyrics` — `id, card_id, line_position, text, chord_positions jsonb`.
- `card_takes` — join `takes.id` ↔ `card_id` (a take can belong to one card; reassign via update). Existing `takes` table keeps audio.
- `card_attachments` — `id, card_id, kind (scripture|note|chord_chart|idea), payload jsonb, created_by`.
- `card_activity` — `id, card_id, song_id, user_id, event_kind, payload jsonb, created_at` (IDs only, no raw lyrics — per memory rule).
- Extend `idea_captures` with `target_card_id uuid null`. Null = inbox.

Edge functions:
- `commit-capture` — atomic: writes take(s) + lyrics + chord_positions + attachments + activity rows under one `card_id`, returns `{card_ids[], capture_id}`.
- `move-capture` — reassigns inbox capture to a card (or merges into existing card).
- `recap-since` — Gemini Flash summary "what changed in this card since {timestamp}" using IDs + counts only, never raw lyric text.

RPCs:
- `reorder_final_tree(song_id, ordered_card_ids[])` — single transaction, updates positions, writes one activity row.
- `split_card(card_id, at_line)` / `merge_cards(card_a, card_b)` — preserve take linkage, write activity.

SDK additions at `src/integrations/cog/`:
- `cards.ts` — list, create, update, reorder, split, merge.
- `capture.ts` — extend `commit({ targetCardId? })`.
- `activity.ts` — `cardActivity(cardId)`, `recapCard(cardId, since)`.

## Capture UX when scoped to a card (must be in prompt)

Header changes only — everything else from Phase 2 Capture stays identical:
- Top-left pill replaces "Unfiled" with the card's serif label (e.g. *Verse 1*) + tiny back chevron → Canvas.
- Below pill: muted-gray meta line "Key G · 72 BPM · 3 takes · Sarah, Parker" (tap → card detail sheet).
- Destination chip in ReviewSheet is **locked to this card** (with "Move to another card…" override that opens DestinationPicker).
- All marker words spoken during this session ("chorus", "bridge") create **sibling cards** in the Ideas Tree, linked via `parent_card_id` = current card. Toast: "Chorus idea saved next to Verse 1."
- Commit ribbon copy: "Saved to Verse 1 · Open canvas" → Canvas highlights both the source card and any spawned sibling cards.

## Canvas UX (must be in prompt)

- Tap card → opens **Card Detail Sheet** (bottom 80%): label, status toggle, takes list w/ mini-player, lyrics, chords, attachments, activity, contributors. Primary CTA: gold "Open Capture →" → routes to `/songs/:songId/canvas/c/:cardId/capture`.
- Long-press card → contextual menu: Capture here · Split · Merge with… · Move to Final Tree · Lock · Delete.
- Drag card from Ideas to Final Tree → calls `reorder_final_tree`. Order in Final Tree = song arrangement.
- Inbox lane along bottom: horizontal scroll of unfiled captures; drag onto any card to merge, or onto empty canvas to create new Ideas card.
- "Listen Path" mode (existing F20 spec) plays through Final Tree cards in order using each card's selected take.
- "What changed" pill top-right → opens `recap-since(last_seen_at)` digest, calm copy ("3 new takes in Chorus · Sarah added a bridge idea").

## Collaboration overlays

- Live presence dots on cards (Supabase Realtime channel `song:{id}:presence`).
- Pending suggestion badge on cards with unresolved line-level suggestions (F19).
- Role gating: Viewer = read-only, Reviewer = comment/approve, Contributor = capture into cards + create Ideas cards, Owner = Final Tree edits + lock/delete.

## Handoff doc structure (what gets written)

The output `docs/claude-handoffs/2026-06-08-canvas-capture-bridge.md` will contain, in this order:

1. Mental model + glossary.
2. Routing contract + URL examples.
3. Backend data contract (table DDL stubs, RPC signatures, SDK signatures) — Claude reads, doesn't build.
4. Canvas component spec: `CanvasScene`, `IdeasTree`, `FinalTree`, `InboxLane`, `SectionCard`, `CardDetailSheet`, `ListenPathBar`, `RecapPill`, `PresenceDots`.
5. Capture-from-card delta spec (only the header + destination-chip changes from Phase 2).
6. Round-trip acceptance scenarios (10 numbered, each with exact URL transitions, DB writes, and visual cues).
7. Motion + token usage (reuse existing `--cog-gold`, `--cog-ease-reveal`, 1.2s pulse on landed cards).
8. Out-of-scope list (auth, payments, transcription model swap, export PDFs).

## Backend plan update

Append a "Canvas ⇄ Capture bridge" section to `.lovable/plan.md` listing the new tables, RPCs, edge functions, and SDK files above so the next Lovable turn can ship them without re-planning.

## Acceptance for this turn

- One handoff doc created at `docs/claude-handoffs/2026-06-08-canvas-capture-bridge.md`.
- `.lovable/plan.md` updated with the bridge backend section.
- No edits to `src/components/**`, `src/pages/**`, migrations, or edge functions this turn.

## Out of scope

Implementing the Canvas UI, writing migrations, deploying edge functions, modifying existing Capture components. Those are separate build turns (Claude for UI, Lovable for backend).

---

# Canvas ⇄ Capture bridge — backend items (Lovable lane)

Full UX spec: `docs/claude-handoffs/2026-06-08-canvas-capture-bridge.md`.

## New tables (single migration, with GRANTs + RLS + policies)
- `section_cards` — id, song_id, parent_card_id, tree(ideas|final|inbox), kind(verse|chorus|bridge|pre|tag|hook|intro|outro|vamp|custom), label, position, song_key, bpm, status(idea|working|locked|final), selected_take_id, created_by, timestamps. RLS via `is_song_member`; writes require `song_role ∈ {owner,contributor}`; Final Tree mutations require `owner`.
- `card_lyrics` — id, card_id, line_position, text, chord_positions jsonb.
- `card_attachments` — id, card_id, kind(scripture|note|chord_chart|idea), payload jsonb, created_by.
- `card_activity` — id, card_id, song_id, user_id, event_kind, payload jsonb (IDs + counts only), created_at.

## Table extensions
- `takes` += `card_id uuid references section_cards(id) on delete set null`.
- `idea_captures` += `target_card_id uuid references section_cards(id) on delete set null`.

## RPCs (SECURITY DEFINER, search_path = public)
- `reorder_final_tree(song_id uuid, ordered_card_ids uuid[])`
- `split_card(card_id uuid, at_line int)`
- `merge_cards(card_a uuid, card_b uuid)`
- `set_card_status(card_id uuid, status text)`
- `set_selected_take(card_id uuid, take_id uuid)`

## Edge functions
- `commit-capture` — atomic write of takes + cards + lyrics + activity scoped to optional `target_card_id`; spawns sibling cards for spoken markers; returns `{capture_id, card_ids[]}`.
- `move-capture` — reassign inbox capture to a card OR promote to new Ideas card.
- `recap-since` — Gemini Flash digest over `card_activity` IDs/counts only. NEVER send raw lyric/transcript text to the model.

## Realtime
- Channel `song:{song_id}:presence` for PresenceDots overlay.

## SDK additions (`src/integrations/cog/`)
- `cards.ts` — list/get/create/update/reorder/split/merge/setStatus/setSelectedTake.
- `capture.ts` — extend `commit({ targetCardId? })`.
- `activity.ts` — `cardActivity(cardId)`, `recapSince(songId, since)`.

## Acceptance
- Owner can drag-order Final Tree; contributor cannot.
- Inbox captures appear in `tree='inbox'` and can be moved/promoted.
- `recap-since` payload to AI gateway contains zero lyric/transcript bytes (assert in test).
- Pulse deep-link `?from=capture&card_ids=…` works after `commit-capture` returns.
