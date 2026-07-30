# R20 — Songwriting Room Audit: "Every take is one tap away"

**Goal of the room (unchanged):** everything for this song stays connected here.
**This pass:** the voice side. Audio is first-class content, not an attachment.
When there is a choice between complicating and simplifying — simplify.

---

## What was wrong (backend audit)

1. The voice page fanned out: memos query → `list_takes` per memo → `getTranscript` per memo → a signed URL per take. On a song with 12 memos that is 25+ round trips before a single bar of audio plays.
2. Rename / archive / restore of a take wrote straight to the `takes` table. No activity entry, no single guard — so the feed silently forgot who renamed or hid a take.
3. Archiving the **primary** take left the memo with no primary — the player had nothing to default to.

## What shipped (Lovable, done)

- `song_voice_board(_song_id)` — one request returns every non-deleted memo with: author name + avatar colour, section, duration, notes, nested non-archived takes (primary first, then newest), `take_count`, `primary_take_id`, transcript status and preview, plus `server_time`.
- `rename_take(_take_id, _friendly_name)` and `set_take_archived(_take_id, _archived)` — membership-guarded (viewers blocked), activity-logged (`take_renamed` / `take_archived` / `take_restored`), and archiving the primary take auto-promotes the newest remaining take.
- Nothing is destroyed. Archive is a soft hide; restore always works.
- SDK: `getVoiceBoard(songId)` in `src/integrations/cog/takes.ts`; `renameTake` / `archiveTake` / `unarchiveTake` now call the guarded RPCs (signatures unchanged).

---

## Claude — build brief (frontend only)

### 1. One fetch, then paint
Replace the voice page's fan-out with a single `getVoiceBoard(songId)` under TanStack Query (`["voice-board", songId]`).
- Paint the full list from that payload — never block a row on a signed URL.
- Signed URLs are fetched **lazily on first play** of a take (`getTakeSignedUrl`), cached in a ref map keyed by `storage_path` for the session.
- Realtime take/memo events → `invalidateQueries(["voice-board", songId])`, debounced 400ms.

### 2. The memo row (simple by default)
One card per memo, cream-light, 16px radius:
- Line 1: memo title (or the primary take's friendly name) in serif, 1.05rem charcoal.
- Line 2: `author_name · relative time · m:ss`.
- Right: a single gold circular **play** button — plays the primary take. No menus visible at rest.
- If `take_count > 1`: a quiet text chip under the title — `3 takes` — that expands the card inline. No modal, no drawer.

### 3. Takes, expanded
Expanding reveals a compact stack, primary first with a small gold dot:
- tap a take → it plays and becomes the "now playing" row (waveform bars animate gold).
- long-press / `…` → Make primary · Rename · Archive.
- Renaming is inline text edit, saves on blur, optimistic.
- Archive shows a 6s "Take hidden — Undo" toast wired to `unarchiveTake`. Never say "delete".

### 4. Transcript state, told truthfully
Use `transcript_status` from the board — never a permanent shimmer:
- `ready` → show 2 lines of `transcript_preview`, tappable to open full transcript.
- `pending` / `processing` → one calm line: "Listening to this take…".
- `failed` → "Couldn't read this one" + a quiet **Try again** (`retryTakeTranscript`). The audio is never at risk; say so in the tooltip.

### 5. Mini-player continuity
Playback lives in the existing global mini-player. Navigating away from `/song/:id/voice` must not stop audio. The playing take's row keeps its gold state when you come back.

### 6. Empty + first-run
Empty voice page = one centred line, "No voice ideas yet", and the gold hold-to-record button. No illustration, no tips, no upsell.

### 7. Performance gates
- Voice page interactive in **one** network request.
- No layout shift when takes expand (animate height, `--dur-base`, `--cog-ease`).
- Lists over 30 memos: virtualise.
- Every action optimistic; rollback + toast on error.

### Anti-patterns (do not ship)
- A takes modal. A second nav layer. Red badge counts. Per-take spinner grids.
- Fetching signed URLs for takes the user has not asked to hear.
