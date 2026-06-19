
# Step 2 — Capture → Canvas Promotion Pipeline

Backend + SDK only. Closes the gap between `idea_captures` and `canvas_cards` so a captured idea becomes a first-class canvas card with its audio attached.

## What I learned from the schema
- `idea_captures.song_id` is **nullable** (unfiled captures exist). Promotion must accept an explicit `target_song_id` when capture has none.
- Captures point at `voice_memo_id`, not `take_id`. A capture's "audio" lives in `voice_memos`; `takes` are committed derivatives of a voice memo. So linking a take = pick the most recent take with the same `voice_memo_id`, or null.
- `activity` table does **not** exist yet — it's introduced in Step 3. Step 2 will not write activity rows; Step 3 will retro-fit a shared helper that wraps `promote-capture` and all other writers.
- `canvas_cards.position` is NOT NULL; we'll seed it to `MAX(position)+1` per song.

## Deliverables

### 1. Migration
- `ALTER TABLE public.canvas_cards ADD COLUMN source_capture_id uuid NULL REFERENCES public.idea_captures(id) ON DELETE SET NULL` + unique partial index `(song_id, source_capture_id) WHERE source_capture_id IS NOT NULL` to enforce idempotency.
- `ALTER TABLE public.idea_captures ADD COLUMN promoted_card_id uuid NULL REFERENCES public.canvas_cards(id) ON DELETE SET NULL` (denormalized pointer for fast "is this promoted?" reads).
- Backfill index: `CREATE INDEX ON public.canvas_cards (source_capture_id)`.
- RPC `capture_with_take(payload jsonb)` — single round-trip used by share/intake flows. Creates an `idea_captures` row, an associated `voice_memos` row (status='pending'), returns `{ capture_id, voice_memo_id, upload_path }`. Caller then uploads to the path via a signed URL produced from existing `voice-memo-upload-url` flow (no signed-URL minting in this RPC — keeps the function pure SQL). Grants: `authenticated` only.

### 2. Edge function `promote-capture`
- `verify_jwt = false`; validates session in code via `Authorization` bearer using `_shared/auth.ts` pattern.
- Input (Zod):
  ```ts
  { capture_id: uuid,
    target_song_id?: uuid,        // required if capture.song_id IS NULL
    target_tree: 'ideas'|'final' = 'ideas',
    section_label?: string,
    x?: number, y?: number }
  ```
- Flow:
  1. Load capture; resolve `song_id = capture.song_id ?? target_song_id`. 400 if both null.
  2. Assert caller is song member with role ∈ {owner, collaborator} via existing `song_role`.
  3. **Idempotency:** if a `canvas_cards` row already exists with `source_capture_id = capture.id`, return it.
  4. Pick most recent `takes` row where `voice_memo_id = capture.voice_memo_id` (may be null).
  5. Insert new `canvas_cards`: `kind='idea'`, `body = capture.lyric_snippet ?? ''`, `label = capture.title`, `tree_kind`, `section_label`, `x`, `y`, `position = (max+1)`, `source_capture_id`, `take_id`, `created_by = caller`.
  6. Update `idea_captures.promoted_card_id`.
  7. If take exists and its `transcript_status IN ('none','failed')`, fire-and-forget invoke `transcribe-take` (non-blocking; failure logged, not raised).
  8. Return `{ card_id, take_id: string|null, transcript_pending: boolean, already_promoted: boolean }`.
- Errors: `not_a_member` 403, `capture_not_found` 404, `missing_song` 400, `invalid_input` 400.
- CORS via `_shared/cors.ts` pattern already used in other functions.

### 3. SDK
- `src/integrations/cog/capture.ts` adds:
  - `promoteCapture(input): Promise<{ card_id: string; take_id: string|null; transcript_pending: boolean; already_promoted: boolean }>` calling `functions.invoke('promote-capture')`.
- `src/integrations/cog/intake.ts` adds:
  - `captureWithTake(input): Promise<{ capture_id; voice_memo_id; upload_path }>` calling the new RPC.

### 4. Acceptance tests (via `supabase--curl_edge_functions` + `read_query`)
- **Happy path:** create capture w/ voice_memo + take → promote → row appears in `canvas_cards` with `source_capture_id` set, `take_id` linked, `idea_captures.promoted_card_id` populated.
- **Idempotency:** call promote twice → same `card_id`, `already_promoted=true` on second.
- **Unfiled capture:** capture.song_id null + no `target_song_id` → 400 `missing_song`. With `target_song_id` → success.
- **Authz:** viewer-role member → 403 `insufficient_role`.
- **Transcript trigger:** capture w/ take whose `transcript_status='none'` → `transcript_pending=true`, status flips to `queued`/`processing` shortly.

## Out of scope (later steps)
- Activity log writes (Step 3 retro-fits via shared helper).
- AI section detection.
- UI buttons / pages — Claude's lane.
- Backfill of historical captures already on canvas — leave `source_capture_id` null; new promotions only.

## Risk notes
- Triggering `transcribe-take` from within an edge function: use `supabase.functions.invoke` with `Authorization` of the original caller; if that adds latency, switch to a `pg_net` deferred call in a follow-up.
- Unique partial index on `(song_id, source_capture_id)` prevents duplicate promotions even under race.

Reply "go" to build Step 2.
