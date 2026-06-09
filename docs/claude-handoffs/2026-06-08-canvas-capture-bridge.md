# Canvas ⇄ Capture Bridge — Build Prompt

**Date:** 2026-06-08
**Owner:** Claude Code (UI) + Lovable (backend contract below)
**Status:** Spec frozen, ready to build

This is the canonical handoff for how the **Canvas** (40,000-ft song map) and **Capture** (focused recording surface) interlock. Read top to bottom before touching either surface. Everything in Phase 2 Capture (`docs/claude-handoffs/2026-06-08-capture-phase2.md`) still applies — this doc only adds the bridge.

---

## 1. Mental model

### Canvas = the song's map
A 2D board of **Section Cards** belonging to one song. Two lanes:

- **Ideas Tree** (left): unfiltered captures, alternates, fragments. Anything anyone records lives here first.
- **Final Tree** (right): the curated arrangement. Drag order = song order. Listen Path plays through this top-to-bottom.
- **Inbox Lane** (bottom strip): unfiled captures (recorded from `/capture` with no card context). Drag onto a card to merge, or onto open canvas to promote to an Ideas card.

Each Section Card shows: serif label (Verse 1, Chorus, Bridge, custom), key/BPM badge, 2-line lyric snippet, 32px waveform thumbnail of the selected take, take count, contributor avatars (max 3 + overflow), status dot (idea · working · locked · final), and a last-activity timestamp.

### Capture = the section's room
Opening Capture from a card scopes every take, transcript line, chord, scripture pick, and note to **that one `section_card_id`**. Capture is the **only** way new audio/lyrics/chords enter a card — Canvas never edits content inline, it orchestrates.

### Unfiled Capture
Recording from `/capture` (the home tab, no card context) writes to the **Inbox lane** of whichever song the user picks at commit time (or "New Song"). The user can later drag it onto an existing card or promote it to its own Ideas card.

### Glossary
- **Card** = `section_cards` row.
- **Take** = one continuous audio recording (existing `takes` table).
- **Capture session** = one open→record→review→commit cycle (existing `idea_captures` row, can produce N takes and N cards).
- **Marker** = spoken or typed section label inside a recording ("verse one", "chorus") that splits the take into multiple cards.

---

## 2. Routing contract

| URL | Surface | Scope |
|---|---|---|
| `/songs/:songId/canvas` | Canvas | Whole song |
| `/songs/:songId/canvas/c/:cardId` | Canvas + Card Detail Sheet open | One card |
| `/songs/:songId/canvas/c/:cardId/capture` | Capture, scoped | Writes default to that card |
| `/capture` | Capture, unfiled | Writes to Inbox of chosen song |

**Post-commit deep-links** (Capture → Canvas):
`/songs/:songId/canvas?from=capture&capture_id=<uuid>&card_ids=<uuid,uuid>`
→ Canvas mounts, scrolls to first card in `card_ids`, pulses all listed cards gold for 1.2s using `--cog-ease-reveal`.

**Back navigation:** from `/canvas/c/:cardId/capture`, back chevron returns to `/canvas/c/:cardId` (sheet still open). From `/capture`, back chevron returns to wherever the user came from (home).

---

## 3. Backend data contract (Lovable owns — Claude reads only)

### New tables

```sql
-- section_cards: the atoms of Canvas
create table public.section_cards (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  parent_card_id uuid references public.section_cards(id) on delete set null,
  tree text not null check (tree in ('ideas','final','inbox')) default 'ideas',
  kind text not null check (kind in ('verse','chorus','bridge','pre','tag','hook','intro','outro','vamp','custom')),
  label text not null,                 -- "Verse 1", "Chorus", or custom
  position int not null default 0,     -- order within (song_id, tree)
  song_key text,                       -- e.g. "G", "Am"
  bpm int,
  status text not null check (status in ('idea','working','locked','final')) default 'idea',
  selected_take_id uuid,               -- which take Listen Path plays
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_lyrics (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.section_cards(id) on delete cascade,
  line_position int not null,
  text text not null,
  chord_positions jsonb not null default '[]'::jsonb,  -- [{chord:"G", char:0}, ...]
  created_at timestamptz not null default now()
);

create table public.card_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.section_cards(id) on delete cascade,
  kind text not null check (kind in ('scripture','note','chord_chart','idea')),
  payload jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.card_activity (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.section_cards(id) on delete cascade,
  song_id uuid not null,
  user_id uuid not null,
  event_kind text not null,            -- 'take_added','lyrics_edited','status_changed','moved_to_final', etc.
  payload jsonb not null default '{}'::jsonb,  -- IDs + counts only, NEVER raw lyric text
  created_at timestamptz not null default now()
);
```

### Extensions to existing tables

- `takes`: add `card_id uuid references section_cards(id) on delete set null` — links each take to its card. Null = orphan (shouldn't happen post-commit).
- `idea_captures`: add `target_card_id uuid references section_cards(id) on delete set null` — null means "unfiled / inbox".

### RLS (all card-scoped tables)
- Every policy uses `is_song_member(song_id, auth.uid())`.
- Write policies additionally check `song_role(song_id, auth.uid())` allowed in `{owner, contributor}` (reviewers/viewers blocked from write).
- Final Tree writes (`tree='final'`, position changes) require `owner` role.

### GRANTs
`GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated;` `GRANT ALL … TO service_role;` No `anon` grants.

### Edge functions
- **`commit-capture`** — atomic: given `{capture_id, target_card_id?, sections:[{label,kind,take_blob_ref,transcript,chord_positions}]}`, writes takes (linked to cards), creates new sibling cards for any extra section markers (with `parent_card_id = target_card_id`), writes `card_lyrics`, writes one `card_activity` row per card with `event_kind='take_added'`, returns `{capture_id, card_ids:[]}`.
- **`move-capture`** — reassigns an inbox capture (and its takes) to a target card OR promotes it to a new Ideas card. Writes `card_activity event_kind='moved'`.
- **`recap-since`** — input `{song_id, since:timestamptz}`. Reads `card_activity` rows since, groups by card, calls Lovable AI Gateway (Gemini Flash) with **IDs + event kinds + counts only**. Returns short calm summary strings. **Never sends raw lyric/transcript text to the model.**

### RPCs
- `reorder_final_tree(song_id uuid, ordered_card_ids uuid[])` — single tx, updates `position` and `tree='final'` for each; writes one `card_activity event_kind='arranged'`.
- `split_card(card_id uuid, at_line int)` — creates new card with lines ≥ at_line, links via `parent_card_id`, reassigns affected takes by their time offsets.
- `merge_cards(card_a uuid, card_b uuid)` — appends b's lyrics + takes into a, soft-deletes b, writes activity.
- `set_card_status(card_id uuid, status text)`.
- `set_selected_take(card_id uuid, take_id uuid)`.

### SDK (`src/integrations/cog/`)
- `cards.ts` — `listCards(songId)`, `getCard(cardId)`, `createCard(...)`, `updateCard(...)`, `reorderFinalTree(...)`, `splitCard(...)`, `mergeCards(...)`, `setStatus(...)`, `setSelectedTake(...)`.
- `capture.ts` — extend existing `commit({ targetCardId?: string })`.
- `activity.ts` — `cardActivity(cardId)`, `recapSince(songId, since)`.
- All return typed Zod-validated results, no raw Supabase types leaked.

---

## 4. Canvas component spec

All files live under `src/components/canvas/**`. None exist yet — all new.

| Component | Job |
|---|---|
| `CanvasScene.tsx` | Page shell. Cream bg, radial glow, header (song title + RecapPill + "+" menu), two-tree layout, Inbox lane. Reads `?from=capture&card_ids=…` and triggers pulse. |
| `IdeasTree.tsx` | Left lane. Vertical scroll, masonry of `SectionCard`s grouped loosely by `kind`. Empty state: "No ideas yet · tap the mic to capture one." |
| `FinalTree.tsx` | Right lane. Drag-orderable list (dnd-kit). Order = arrangement. Listen Path plays through this. |
| `InboxLane.tsx` | Bottom 96px horizontal scroll of unfiled captures. Drag handle on each. Empty: hidden. |
| `SectionCard.tsx` | The card itself. 320×180 mobile, gold border when selected, status dot top-right, avatars bottom-left, take count + waveform thumb. Tap → opens CardDetailSheet. Long-press → ContextualMenu. |
| `CardDetailSheet.tsx` | Bottom sheet, 80vh. Header: label (editable), kind chip, key/BPM editor. Body tabs: Takes · Lyrics · Chords · Attachments · Activity · People. Primary gold CTA pinned bottom: **"Open Capture →"**. |
| `ListenPathBar.tsx` | Floating bar bottom-center on Canvas. Play/pause, current card label, progress through Final Tree. |
| `RecapPill.tsx` | Top-right pill. Shows "3 new since Tue" with gold dot if unseen. Tap → recap sheet calling `recapSince`. |
| `PresenceDots.tsx` | Overlay on cards: small avatars of users currently viewing that card via Realtime channel `song:{id}:presence`. |
| `CardContextMenu.tsx` | Long-press menu: Capture here · Split here · Merge with… · Move to Final Tree · Lock · Delete. Role-gated. |

### Visual tokens (reuse, do not invent)
- Background: `--cog-cream` with `.cog-glow` overlay.
- Card: `--cog-cream-light`, `--cog-border`. Selected/pulsed: `--cog-border-gold` + box-shadow `0 0 0 4px var(--cog-gold-glow)`.
- Status dot colors: idea=`--cog-muted`, working=`--cog-gold-light`, locked=`--cog-warm-gray`, final=`--cog-gold`.
- Pulse animation: `transform: scale(1) → 1.03 → 1`, `box-shadow` gold glow fade, 1200ms, `--cog-ease-reveal`.

---

## 5. Capture-from-card delta spec

When Capture mounts at `/songs/:songId/canvas/c/:cardId/capture`, the only diffs from Phase 2 Capture are:

1. **Top-left pill**: replace "Unfiled" with `‹ Verse 1` (serif, charcoal, gold underline on hover). Tap → back to Canvas card.
2. **Meta line under pill**: muted-gray 12px — `"Key G · 72 BPM · 3 takes · Sarah + Parker"` — tap opens CardDetailSheet over Capture.
3. **DestinationPicker default**: locked to current card. "Move to another card…" link reveals picker with Ideas / Final / Inbox / New card options.
4. **Spoken marker behavior**: marker words during this session create **sibling cards** with `parent_card_id = current cardId`, dropped into the same tree (`ideas` by default). Toast on commit: *"Chorus idea saved next to Verse 1."*
5. **CommitRibbon copy**: `"Saved to Verse 1 · Open canvas →"`. Deep-link includes the source card + any spawned siblings in `card_ids`.
6. **No prompt rotation** — the rotating serif prompt is replaced by the static line *"Capturing inside Verse 1"* so the user always knows the scope.

Everything else (BigMic, RMS ring, hold-to-hum, two-finger scratch, BottomDock typed markers, ReviewSheet card reorder/merge/split, dictation engine, smart formatting) is unchanged.

---

## 6. Round-trip acceptance scenarios

1. **Card → Capture → back** Tap Verse 1 on Canvas → sheet opens → tap "Open Capture →" → URL becomes `/songs/abc/canvas/c/v1/capture`, pill reads `‹ Verse 1`. Record 4s hum → release → review sheet shows 1 take card with destination locked to Verse 1 → commit → ribbon "Saved to Verse 1 · Open canvas →" → tap → URL `/songs/abc/canvas?from=capture&capture_id=…&card_ids=v1` → Verse 1 card pulses gold 1.2s, take count increments to 2, waveform thumb updates.

2. **Sibling spawn from spoken marker** From Verse 1 Capture, record "this melody… chorus, lift it higher" → review sheet shows 2 cards (Verse 1 take, Chorus idea) → commit → 2 sibling card_ids returned → Canvas pulses Verse 1 + new Chorus card adjacent in Ideas Tree. New card's `parent_card_id = v1`.

3. **Unfiled → Inbox → assign** From `/capture` record an idea → at commit pick "Song: Holy Ground" with no card → card_activity row writes to Inbox lane → user drags Inbox card onto Verse 2 → `move-capture` runs → take re-links to Verse 2 → Inbox card disappears → Verse 2 pulses.

4. **Promote inbox to Ideas card** Drag Inbox card onto empty Canvas region → creates new `section_cards` row, `tree='ideas'`, `kind='custom'`, label "Untitled idea" → pulse.

5. **Drag to Final Tree** Owner drags Chorus from Ideas to Final → `reorder_final_tree` writes positions → Final Tree re-renders → activity row `event_kind='arranged'`.

6. **Listen Path** Tap play in ListenPathBar → plays Final Tree cards in order, each using `selected_take_id` → card currently playing gets gold left border.

7. **Split card** Long-press Verse 1 → Split here → pick line 3 → new card "Verse 1b" appears next to Verse 1, takes after line 3 reassigned by time offset.

8. **Recap pill** Returning user opens Canvas → RecapPill shows gold dot → tap → sheet renders `recapSince(lastSeenAt)` summary like "3 new takes in Chorus · Sarah added a bridge idea" → no raw lyrics ever in the network payload.

9. **Role gate** Reviewer opens Canvas → "Open Capture →" CTA hidden, status toggle disabled, drag handles hidden on Final Tree, contextual menu shows only "Comment".

10. **Presence** Two users on same song → each sees the other's avatar dot on whatever card they're viewing → moving to another card moves the dot.

---

## 7. Motion + tokens

- Card mount: `translateY(8px) → 0`, opacity 0→1, 400ms `--cog-ease-reveal`, staggered 30ms per card.
- Card pulse on landing from Capture: see §4.
- CardDetailSheet: slide up from bottom, 600ms `--cog-ease-reveal`, scrim `rgba(28,26,23,0.45)`.
- Drag preview: card lifts with `scale(1.04)`, shadow `0 12px 32px rgba(28,26,23,0.18)`.
- Listen Path active card: gold left border slides in 200ms.
- No bouncy easing anywhere. No red badges. No notification dots beyond the single gold "unseen" dot on RecapPill.

---

## 8. Out of scope (this build turn)

- Auth, payments, storage quotas (already shipped or owned by Lovable).
- Transcription model selection (Phase 4).
- PDF/audio export from Final Tree (later).
- Compare Mode (F21), Merge & Splice Mode (F22), Line-level Suggestions (F19) — separate handoffs.
- Editing the existing Capture components beyond the §5 deltas.

---

## 9. Build order

1. **Lovable**: migrations for `section_cards`, `card_lyrics`, `card_attachments`, `card_activity`, extensions to `takes` + `idea_captures`. RPCs + edge functions. SDK files.
2. **Claude**: `CanvasScene` + `SectionCard` + `IdeasTree` + `FinalTree` + `InboxLane` shells reading from SDK.
3. **Claude**: `CardDetailSheet` + tabs.
4. **Claude**: Capture §5 deltas (pill, meta line, destination lock, sibling spawn, commit copy, deep-link payload).
5. **Lovable**: `recap-since` edge function + Realtime presence channel setup.
6. **Claude**: `RecapPill` + `PresenceDots` + `ListenPathBar`.
7. **Codex**: stress test 200-card Canvas scroll, drag perf, deep-link pulse FPS.