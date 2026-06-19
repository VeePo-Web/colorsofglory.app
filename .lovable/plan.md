
# Top 3 Next Functional Steps (Lovable lane only)

Scope: backend (DB, RLS, edge functions, RPCs) + thin SDK at `src/integrations/cog/*`. Zero pages or components. All three target the Canvas + Capture loop, which is the product's spine.

Current state I observed:
- `canvas.ts` SDK = 4 fns (commit/list/delete/update). No move, link, group, section-assign, or batch ops.
- `capture.ts` SDK = quickCapture + list + delete. No "promote capture → canvas card" RPC.
- `takes.ts` is solid (CRUD + signed URL + primary).
- `activity` table exists, but most write paths (capture, take, canvas update) likely don't insert into it consistently.
- No Supabase Realtime channel scoping or presence helpers anywhere.

---

## Step 1 — Canvas Write API: move, link, group, assign-to-section

**Why first:** Canvas is currently read-mostly. Without arrange/link/group ops, the Ideas Tree and Final Tree concept (Product Vision 02, Feature 05) cannot function. UI work is blocked on these RPCs.

**Deliverables**
- Migration adds to `canvas_cards`: `parent_card_id uuid null`, `group_id uuid null`, `tree_kind text check in ('ideas','final') default 'ideas'`, `section_label text null`, `z_index int default 0`. Indexes on `(song_id, tree_kind)` and `(song_id, parent_card_id)`.
- New SECURITY DEFINER RPCs (all gated by `is_song_member`):
  - `canvas_move_card(card_id, x, y, z_index)` — single write, returns updated row.
  - `canvas_bulk_move(payload jsonb)` — `[{id,x,y,z}]` for drag-multi.
  - `canvas_link_cards(parent_id, child_id)` — sets `parent_card_id`, validates same song + no cycle.
  - `canvas_unlink_card(card_id)`.
  - `canvas_group_cards(card_ids uuid[])` — assigns new `group_id`.
  - `canvas_set_section(card_id, section_label, tree_kind)` — moves between Ideas/Final trees.
  - `canvas_promote_to_final(card_id)` — clones card into Final tree, preserves origin via `parent_card_id`.
- RLS: SELECT/INSERT/UPDATE/DELETE on `canvas_cards` all use `is_song_member(song_id, auth.uid())`; writes additionally require role ≥ contributor via `song_role()`.
- SDK additions in `src/integrations/cog/canvas.ts`:
  `moveCard`, `bulkMove`, `linkCards`, `unlinkCard`, `groupCards`, `setSection`, `promoteToFinal`. Typed inputs/outputs.

**Acceptance**
- `supabase--linter` clean.
- `curl_edge_functions`/`read_query` proves: contributor can move, viewer cannot; cross-song link rejected; cycle rejected.
- All RPCs return `{ ok, card }` shape.

**Out of scope:** UI, drag handles, animations — those are Claude's lane.

---

## Step 2 — Capture → Canvas Promotion Pipeline

**Why second:** Today `idea_captures` and `canvas_cards` are two parallel buckets. The product promise is "everything for this song stays connected here." A capture must flow into the canvas with one call, with its take attached and (when audio) transcription kicked off.

**Deliverables**
- New edge function `promote-capture` (verify_jwt=false, validates session in code):
  - Input: `{ capture_id, target_tree: 'ideas'|'final', section_label?, x?, y? }`.
  - Verifies caller is song member with role ≥ contributor.
  - Creates a `canvas_cards` row carrying `source_capture_id`, copies title/preview text, links the take if capture had audio.
  - If the capture has a take with no transcript, enqueues `transcribe-take` (existing) async.
  - Inserts an `activity` row `kind='capture_promoted'`.
  - Returns `{ card_id, take_id?, transcript_pending: boolean }`.
- Column add: `canvas_cards.source_capture_id uuid null` + index.
- RPC `capture_with_take(payload)` — single-shot used by share-intake flows: creates capture + take + signed upload URL in one round trip (eliminates current 3-call dance in `intake.ts`).
- SDK: `promoteCapture(input)` in `capture.ts`, `captureWithTake(input)` in `intake.ts`.
- Backfill migration: for existing captures already on canvas (matched by id heuristic), set `source_capture_id`.

**Acceptance**
- E2E via `curl_edge_functions`: create capture with audio → call promote → card row exists with `source_capture_id`, take linked, activity row written, transcription job present.
- Negative: non-member 403, already-promoted capture returns existing card_id (idempotent).

**Out of scope:** Auto-section-detection AI (Phase 4), UI buttons.

---

## Step 3 — Realtime + Activity Layer for the Song Room

**Why third:** Once writes exist (Step 1) and pipeline exists (Step 2), collaborators need to *see* changes without refresh. This is the "What changed since you left" promise (Product Vision 08). Today no edge function publishes consistently to `activity`, and no realtime channel is scoped.

**Deliverables**
- Audit + patch: every write edge function (`create-song`, `commit-take`, `intake-voice-memo`, `voice-memo-finalize`, `song-invite-accept`, new canvas RPCs, new `promote-capture`) inserts a typed row into `activity` with `{song_id, actor_user_id, kind, entity_id, payload_ids_only}`. Enforce via shared helper `_shared/activity.ts`.
- Migration: enable Supabase Realtime publication on `canvas_cards`, `takes`, `idea_captures`, `activity` (filtered by `song_id`); add `REPLICA IDENTITY FULL` where needed for delete payloads.
- New RPC `list_activity_since(song_id, since timestamptz)` — returns digest grouped by actor + kind, used by "What changed since you left" card.
- New RPC `mark_song_seen(song_id)` — writes to `song_notification_prefs.last_seen_at`.
- SDK additions:
  - `activity.ts`: `listSince(song_id, since)`, `markSeen(song_id)`.
  - New `realtime.ts`: `subscribeSongRoom(song_id, handlers)` returning unsubscribe — wraps the four channels behind one typed API so Claude's components never touch `supabase.channel(...)` directly.
- Edge function `digest-recap` (Lovable AI Gateway, Gemini Flash) — summarizes `list_activity_since` into the one-paragraph recap shown on return. IDs only, no lyric text sent to AI (per Core rule).

**Acceptance**
- Two browser sessions: B sees A's canvas move within <1s.
- `list_activity_since` returns grouped digest after a multi-actor burst.
- AI digest never receives raw lyric/memo content (verified by logging the prompt payload).

**Out of scope:** Presence avatars UI, toast styling, notification preferences screen.

---

## Build order recommendation

1, then 2 (depends on canvas write RPCs), then 3 (depends on both for meaningful activity events). Each step is one focused Lovable session with its own migration + linter pass + curl tests before moving on.

Reply "go" to start Step 1, or tell me to re-rank.
