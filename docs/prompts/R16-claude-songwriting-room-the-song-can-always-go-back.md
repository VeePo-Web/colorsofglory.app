# R16 — The Song Can Always Go Back

**Audit focus:** version history, restore, undo.
**One goal reminder:** the room exists so a song can grow without fear. Fear
is what makes people copy lyrics into Notes "just in case". Restore must feel
so safe and so boring that nobody keeps a backup elsewhere.

---

## What the audit found

1. **Restore was a four-step client dance.** Capture current state → insert a
   safety version → upsert/delete sections + lyrics → insert a restore marker.
   Four round trips, no transaction. A dropped connection between step 2 and
   step 3 left a song half-restored with a confusing timeline.
2. **The history screen downloaded every snapshot.** `listVersions` selected
   `*`, so opening `/songs/:id/versions` on a song with 40 versions pulled
   40 full lyric copies just to render "v12 · Sarah · 2 days ago".
3. **No human summary per entry.** Users could not tell what a version held
   without opening it.

## What shipped (backend — already live)

### `restore_song_version(_song_id, _version_id)` → jsonb
One transaction, all or nothing:
1. saves the song exactly as it is now (`kind: auto`, "Before restoring vN"),
2. brings sections + lyrics to the target snapshot,
3. records a `restore_point` branched from the version that was revived.

Returns `{ pre_restore_version_id, restore_point_version_id,
restored_from_version_number }`. Write-gated (`_assert_song_write`), so
viewers can never trigger it. Errors: `VERSION_NOT_FOUND`,
`SNAPSHOT_UNREADABLE`.

### `song_version_timeline(_song_id, _limit)` → rows
Everything the list needs and nothing more: `version_number`, `kind`, `label`,
`description`, `parent_version_id`, `created_by_name`, `created_at`,
`section_count`, `line_count`. No snapshot blob.

### SDK — `src/integrations/cog/versions.ts`
```ts
import { listVersionTimeline, getVersion, restoreVersion } from "@/integrations/cog/versions";

const timeline = await listVersionTimeline(songId);        // list screen
const full     = await getVersion(entry.id);               // only on preview
const { preRestoreVersion } = await restoreVersion(songId, entry.id);
```
`restoreVersion` is now a single RPC call and keeps the same return shape.

---

## Claude's build brief (frontend only)

**Route:** `/songs/:id/versions`

1. **List from `listVersionTimeline`.** Never `listVersions` in the list view.
   Each row: serif version label (fall back to `v{n}`), then one calm meta line
   — `{created_by_name} · {relative time} · {section_count} sections ·
   {line_count} lines`.
2. **Kind styling, no badges shouting.**
   - `manual` — plain row.
   - `auto` — muted row, smaller label ("Before restoring v7", "Original").
   - `restore_point` — a thin gold left rule; that is the only accent.
3. **Preview before restore.** Tapping a row opens a sheet that lazily calls
   `getVersion`, shows the lyric sheet read-only, and has one gold CTA:
   **Bring the song back to this**.
4. **Confirm in one sentence, not a scary dialog.**
   "We'll save the song as it is right now first, so nothing is lost."
   Buttons: *Bring it back* / *Cancel*.
5. **After restore: undo is a toast, not a menu.**
   `Restored from v{n} · Undo` — Undo calls
   `restoreVersion(songId, preRestoreVersion.id)`. Toast lives 8s.
6. **Optimistic, then truthful.** Show the restored sheet immediately from the
   snapshot you already fetched for the preview; refetch the room in the
   background. On error, revert and show
   "That restore didn't go through — the song is unchanged."
   (That sentence is now literally true: the RPC is transactional.)
7. **Empty state.** If a song has only "Original", say
   "Every save from here will show up on this timeline." No CTA.

## Anti-patterns for this screen
- No diff view. Preview + restore + undo is enough. (Simple beats clever.)
- No red destructive styling anywhere — restore destroys nothing.
- No "are you sure?" twice.
- No version count badge in the room header.

## Done when
- The list renders 100 versions with no snapshot payload in the network tab.
- Restore is exactly one request.
- Undo restores the pre-restore state and appears in the timeline as its own
  entry.
- A viewer sees the timeline read-only with no restore CTA.