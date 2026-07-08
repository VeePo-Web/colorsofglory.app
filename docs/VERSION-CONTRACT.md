# VERSION CONTRACT — Version History (E3)

**Surface:** `/songs/:id/versions` · **Table:** `song_versions` · **Seam:** `src/integrations/cog/versions.ts`
**Published by:** E3 · **Consumed by:** A2 (type home), A3 (data layer), A5 (route), E1 (gating), E2 (activity), D2/D3 (the non-destructive ethos this makes literal)

---

## 1. What a version is

A **version** is a snapshot of the song's restorable state at a moment in time — one row in
`song_versions` (`id`, `song_id`, `version_number`, `kind`, `label`, `description`, `snapshot`,
`parent_version_id`, `created_by_user_id`, `created_at`).

- `version_number` is assigned **server-side** (BEFORE-INSERT trigger, `UNIQUE(song_id, version_number)`).
  Clients never set it.
- `kind` (enum `version_kind`):
  - `manual` — a songwriter's "Save a version" (optional label, e.g. "Before the bridge rewrite")
  - `auto` — system safety snapshots: the seeded **Original** and every **"Before restoring vN"** pre-restore capture
  - `restore_point` — the version created *by* a restore; its parent is the version that was restored
- `parent_version_id` is the lineage backbone. Every new snapshot chains onto the current head,
  so the **only parentless version is the very first — the Original**. A restore *branches*:
  its parent is the restored version, which is how "Restored from v3" is provable from data.

### The snapshot payload (v1 — rows-based, editor-agnostic)

```jsonc
{
  "v": 1,
  "song": { "title": "Colors of Glory" },          // string | null
  "sections": [                                     // ordered by position
    {
      "id": "…",                                    // song_sections.id (stable across restore)
      "kind": "verse",                              // section_kind enum, verbatim
      "label": "Verse 1",                           // string | null
      "position": 0,
      "lyrics": {                                   // or null (labeled-but-unwritten section)
        "content": { /* opaque Json, verbatim */ }, // chord-anchor payloads round-trip losslessly
        "plain_text": "Morning light\n…"
      }
    }
  ]
}
```

`song_sections` + `song_lyrics` rows are the DB truth for the song's words regardless of which
editor wrote them, so the snapshot captures those rows verbatim. `lyrics.content` is treated as
**opaque Json** — whatever payload an editor stores (e.g. the `{v:1, lines:[{anchors}]}`
chord-anchor shape) is preserved byte-for-byte and restored byte-for-byte.

**Not in the snapshot:** voice memo audio (immutable storage objects — no write path ever
destroys them, so they need no restore), the activity feed (E2's, append-only), credits (E4's),
and canvas cards (D-group; a candidate `v: 2` extension — the codec is versioned exactly so
this can grow without breaking old rows).

Unreadable/foreign snapshots parse to `null` and render as a calm "kept safe, can't be
previewed" card — **never raw JSON, never a crash** — and cannot be restored.

## 2. The A3 data API (filed and implemented — `src/integrations/cog/versions.ts`)

Same pattern as the other cog seams: this module is the **only** place that queries
`song_versions`. No component, hook, or page touches the table. While no shared `@/types`
barrel exists in this tree, the seam is also the canonical home of the `SongVersion` row type
(generated `Database` row, never hand-authored); when a barrel ships, it should re-export from
here. Errors surface as `CogError` (from `cog/songs.ts`). Pure helpers (`parseSnapshot`,
`summarizeSnapshot`, `findOriginalId`) are unit-tested in `src/test/version-history.test.ts`.

| Function | Contract |
|---|---|
| `listVersions(songId)` | All versions, newest-first by `version_number`. RLS: members only. |
| `getVersion(id)` | One version or a calm `CogError("SONG_NOT_FOUND")`. |
| `createSnapshot(songId, {kind?, label?, description?, parentVersionId?, snapshot?})` | Captures current state (unless a snapshot is passed), chains `parent` onto the head (unless explicitly overridden), inserts. Number assigned by the DB. |
| `ensureOriginalVersion(songId)` | Seeds the root (`kind: auto`, label "Original", parent `null`) iff the song has none. Race-safe: a lost insert race just refetches. |
| `restoreVersion(songId, versionId)` | The restore law, below. Returns `{ preRestoreVersion, restoredVersion }`. |
| `captureCurrentState(songId)` | Current `{title, sections}` as a v1 snapshot (reads `songs.title`, `song_sections`, `song_lyrics`). |

There is deliberately **no delete** in this API and no delete anywhere in the UI, even though
RLS would allow owners to. The timeline only ever grows.

## 3. Restore semantics — THE RESTORE LAW

**Restore is never an overwrite.** `restoreVersion` runs three steps, in this order, and the
order *is* the guarantee:

1. **Preserve first.** Capture the current state and save it as a new version
   (`kind: auto`, label `"Before restoring vN"`, parent = current head). After this line,
   nothing can be lost — even if everything else fails.
2. **Apply.** Bring the live `song_sections`/`song_lyrics` rows to exactly the target
   snapshot's state (upsert kept sections + lyrics, remove rows the snapshot doesn't hold —
   their content lives on in the pre-restore version).
3. **Record.** Save the restored state as a `restore_point` whose
   `parent_version_id = the restored version` (visible lineage: "Restored from v3").

Failure modes (all recoverable, all honest): fail at 1 → nothing changed; fail at 2 → the
pre-restore version already exists, every state is on the timeline; fail at 3 → the song state
is correct and preserved, only the restore marker is missing — retrying re-runs the whole safe
sequence.

**Undo is not a special case.** Undo = `restoreVersion(songId, preRestoreVersion.id)` — the
same non-destructive path, which is why the UI can offer it with a straight face.

## 4. Original preservation

- The **Original** = the song's first-ever version: lowest `version_number`
  (`findOriginalId`), also the only parentless row under normal lineage. Detection uses the
  number, not the FK, so a nulled-out parent chain (`ON DELETE SET NULL`) can't orphan it.
- Seeded automatically (`ensureOriginalVersion`) on the first visit by anyone who can write,
  from whatever the song holds at that moment.
- Visually distinguished (gold shield badge), always restorable via the one-tap
  **"Return to the original"** action, and **never deletable** — the UI exposes no delete at all.
- Copy commitment: *"Your first version is always safe. It can never be deleted, and you can
  return to it anytime."*

## 5. Role gating (E1 handoff)

`useVersionCapabilities(songId)` in `src/components/versions/useSongVersions.ts` is the
**interim E1 seam**: it maps `cog/members.myRole` — `owner`/`collaborator` → may save + restore;
`viewer`/non-member → read-only timeline. When E1's `useCapabilities`
(`src/lib/permissions`) is complete in this tree, collapse this hook to consume it; components
only ever see `{ canSave, canRestore }`. The server (RLS) remains the real gate regardless.

## 6. Activity event (E2 handoff)

A restore/save **emits** activity; E2 **renders** it — E3 never touches the feed.

- Already live server-side: the `touch_activity_on_song_versions` trigger bumps song activity
  on every version insert.
- Client kinds documented for E2's union: **`version_saved`** and **`version_restored`**,
  payload = `{ song_id, version_id }` — **IDs + kind only, never snapshot content** (the
  app-wide "no raw content in activity payloads" rule). The client emit in `versions.ts` is a
  deliberate no-op until E2 publishes an ingest path (same posture as the notes lane); a
  version write never depends on it.

## 7. Open items

- **E2:** add `version_saved` / `version_restored` to the activity kind union + an ingest
  path; then fill the emit in `versions.ts`.
- **E1:** finish `useCapabilities` in this tree; collapse `useVersionCapabilities` onto it.
- **Lovable (only if product wants title restore):** applying a snapshot restores the
  section/lyric rows; the stored `song.title` is displayed but not written back (no
  `updateSong` seam exists yet).
- **D-group:** canvas-card state as a `v: 2` snapshot extension, if canvas restore is scoped.
