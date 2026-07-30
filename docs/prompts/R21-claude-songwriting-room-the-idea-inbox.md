# R21 — Songwriting Room Audit: "Nothing you capture stays homeless"

**Goal of the room (unchanged):** everything for this song stays connected here.
**This pass:** the capture → inbox → canvas path. Simple beats clever.

---

## What was wrong (backend audit)

1. `deleteCapture` was a **hard delete**. The one thing the product promises — your idea is safe — was violated by the easiest gesture on the card.
2. Unfiled ideas (captured with no song) had no way home: no "file this into a song" action. They accumulated forever in a list nobody could resolve.
3. The inbox took multiple queries and still didn't know whether an idea had already become a canvas card, who wrote it, or how long its voice memo was.

## What shipped (Lovable, done)

- `idea_captures.archived_at / archived_by` + partial index. Archive is a soft hide; restore always works.
- `capture_inbox(_song_id?)` — one request: `unfiled[]` (mine), `song[]` (this song's, with author name), each row carrying `promoted_card_id`, `memo_duration_ms`, tags, scripture ref, `unfiled_count`, `server_time`.
- `set_capture_archived(_capture_id, _archived)` — author-or-editor guarded, activity-logged (`capture_archived` / `capture_restored`) when song-scoped.
- `file_capture_into_song(_capture_id, _song_id, _section_id?)` — membership-guarded, bumps `last_activity_at`, logs `capture_filed`.
- SDK (`src/integrations/cog/capture.ts`): `getCaptureInbox`, `fileCaptureIntoSong`, `restoreCapture`, `archiveCapture`; `deleteCapture` kept as an alias that now archives; both list helpers filter archived rows.

---

## Claude — build brief (frontend only)

### 1. One inbox, one fetch
`useQuery(["capture-inbox", songId ?? "me"], () => getCaptureInbox(songId))`. Render everything from that payload. No per-card follow-up fetch.

### 2. The idea card (as small as it can be)
Cream-light, 16px radius, 12px vertical rhythm:
- Title, or the first line of `lyric_snippet` if untitled (serif, 1rem, 2-line clamp).
- Meta line: `author_name · relative time`, plus a gold mic pill `0:14` when `memo_duration_ms` exists, plus scripture ref as a pale-gold chip when present.
- Already promoted (`promoted_card_id`) → a quiet "On the canvas" text label and the card sits in a dimmed, collapsed group at the bottom. Not a badge. Not a count.

### 3. Two swipes, no menus
- Swipe left → **Archive** (soft), with a 6s "Idea archived — Undo" toast wired to `restoreCapture`. The word *delete* never appears.
- Swipe right → **Add to canvas** (`promoteCapture`), optimistic, card animates into the promoted group.
- Tap → open the capture sheet for editing. That's the whole interaction model.

### 4. Unfiled ideas get a home
If `unfiled_count > 0`, show a single section at the top: "Not in a song yet · N".
- Each row has one gold action: **Add to a song** → a compact song picker sheet (recent songs first, then "New song") → `fileCaptureIntoSong`.
- After filing, the row leaves the unfiled list with a 250ms slide and the toast reads "Filed into *Song Title*".
- When `unfiled_count === 0`, the section does not render at all. No empty scaffolding.

### 5. Capture stays instant
The capture bar must never wait on the network: generate `client_key` with `crypto.randomUUID()` at commit time, insert optimistically into the inbox cache, then `quickCapture`. On failure keep the card with a small "Saving…" then "Retry" affordance — never lose the text.

### 6. Performance gates
- Inbox interactive in one request; first paint under 300ms from cached data.
- Swipe gestures at 60fps (transform-only, no layout thrash).
- Realtime capture events → debounced invalidate (400ms), never a full page spinner.
- Lists past 40 rows: virtualise.

### Anti-patterns (do not ship)
- Hard delete anywhere. Confirmation dialogs for archiving. Red counts.
- A second "inbox" nav item competing with the canvas — the inbox is a section, not a destination.
