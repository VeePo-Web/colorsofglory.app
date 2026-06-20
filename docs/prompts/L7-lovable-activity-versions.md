# L7 — LOVABLE: Activity Log + Version Snapshots
## Cluster 7/8 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. Two promises to the songwriter: **"you'll always know what changed
> while you were gone"** and **"you'll never lose a version of the song you loved."**
> Backend + the `cog/*` seam only. Calm, not noisy.

## YOUR ROLE
Lovable: Supabase schema/RLS, triggers, edge functions, the typed `cog/activity.ts`
(+ a versions seam). No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Present: tables `song_activity`, `song_versions`, `song_notification_prefs`; an
`activity.ts` seam (a "digest" was started). Roles/membership from L6. Specs:
Product Vision 08 (Calm Activity Intelligence), Vision 09 (Version History Protects the
Song), Feature 12 (What Changed Smart Recap), Feature 24 (Version History + Undo +
Original Preservation).

## OBJECTIVE
A calm, **summarized** activity intelligence layer + reliable, **non-destructive**
version snapshots — both member-scoped and exposed through a clean seam.

## TASKS — ACTIVITY
1. **Event capture:** write structured `song_activity` rows on meaningful changes
   (lyric edit, memo added, chord/key/BPM change, section added/renamed, role change,
   comment) — `actor`, `action`, `entity_type`, `entity_id`, `summary`, `created_at`.
   Prefer DB triggers / a single edge path so nothing is missed; member-scoped RLS.
2. **"Since you left" digest (the magic):** track per-user last-seen per song
   (`song_notification_prefs` or a seen-marker) and compute a **deduped, aggregated**
   recap: *"Sarah added 2 harmony memos · Parker revised Verse 1 · BPM 72→74 · 3 ideas
   in the bridge."* Collapse 10 edits of one section into one line. This is Vision 08 +
   Feature 12 — summary, not firehose.
3. **Calm by design:** no notification spam; rate/aggregate; "needs review" items
   (pending suggestions/comments) surfaced gently, counted but not red-badged.
4. **Mark-seen:** advance the user's last-seen so the digest resets after they look.

## TASKS — VERSIONS
5. **Snapshots (`song_versions`):** capture a full song-state `snapshot_json` (lyrics +
   sections + chords + arrangement + memo refs). Create on demand (user "save version")
   and **auto at milestones** (e.g. before a restore, before a big merge). Label +
   `created_by` + `created_at`.
6. **Non-destructive restore (Critical):** restoring an old version **creates a new
   version** from it — it never overwrites history. Nothing is ever truly lost.
7. **Original preservation:** the first snapshot is permanently protected/flagged.
8. **Diff summary:** store/compute a short "what changed" per version for the timeline.

## SEAM
`cog/activity.ts`: `listActivity(songId)`, `getSinceYouLeft(songId)`, `markSeen(songId)`.
Versions seam: `listVersions`, `snapshot(label?)`, `previewVersion`, `restoreVersion`,
`labelVersion`. Document states + errors for C6/C7.

## DELIVERABLES
1. Reliable event capture (triggers/edge) + RLS. 2. Deduped "since you left" digest +
   mark-seen. 3. Calm "needs review" counts. 4. Version snapshot (manual + milestone).
5. Non-destructive restore + protected original. 6. Per-version diff summary.
7. Documented activity + versions seam.

## ACCEPTANCE CRITERIA
- [ ] Every meaningful change produces one structured activity row; member-scoped.
- [ ] The digest is summarized/deduped per user since last seen; mark-seen resets it.
- [ ] Restore creates a new version and never destroys history; original is protected.
- [ ] Snapshots capture full song state; per-version diff summary available.
- [ ] One typed seam covers everything C6 + C7 need.

## CONSTRAINTS
Backend + seam only. Calm > complete — aggregate, never spam. Never destroy a version on
restore. Never weaken RLS. `lovable/activity-versions` → merge → delete.

## REFERENCES
- tables: `song_activity`, `song_versions`, `song_notification_prefs`; `src/integrations/cog/activity.ts`
- Vision 08/09 PDFs; Feature 12 (Smart Recap) + Feature 24 (Version History) in `zip_extracted/…`
- `docs/prompts/L6-…collaboration-roles-rls.md`, `L1-…schema-consolidation.md`, `docs/BUILD-PATHWAY.md`
