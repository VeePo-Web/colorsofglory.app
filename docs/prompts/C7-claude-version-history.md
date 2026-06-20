# C7 — CLAUDE: Version-History Timeline
## Cluster 8 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. This screen's whole job is **reassurance**: the song is safe, every
> draft is kept, and going back never destroys anything. Mobile-first; tokens only; seam
> only; meet `MOBILE-UX-BENCHMARK.md`. Songwriter truth: *the version I loved last week is
> still there, and I can return to it without fear.*

## YOUR ROLE
Claude: all `src/` UI. Seam only (L7 versions seam); no schema/auth/tests.
`docs/BUILD-PATHWAY.md`.

## CONTEXT
L7 provides `listVersions`, `snapshot(label?)`, `previewVersion`, `restoreVersion`,
`labelVersion`, with per-version diff summaries and a **protected original**. Spec:
Product Vision 09 (Version History Protects the Song), Feature 24 (Version History + Undo
+ Original Preservation). No component exists — build it.

## OBJECTIVE
A calm, trustworthy version timeline: see drafts over time, preview any, restore safely
(non-destructive), and feel the original is permanently protected.

## PHASE 0 — SPEC
Read Vision 09 + Feature 24. The one moment: *I scroll back through my song's life, tap a
past version, and bring it back — and a quiet line assures me nothing was lost.*

## PHASE 4 — BUILD
1. **Timeline:** versions newest→oldest — label, who, when, and the **"what changed"**
   diff summary per entry; the **protected original** clearly marked at the bottom.
2. **Preview:** tap a version to preview its song state (read-only) before deciding.
3. **Restore (non-destructive):** "Restore this version" with calm copy —
   *"This brings it back as a new version. Nothing you have now is lost."* Confirm, then
   call `restoreVersion`; show the new version appear at the top.
4. **Save a version:** a clear "Save this version" action (label optional) → `snapshot`.
5. **Label/rename** a version inline.
6. **Reassurance throughout:** never destructive language; the original is sacred and
   visibly protected. Designed empty state ("Your first version is saved — your song is safe").
7. Mobile-first: 44×44, reduced-motion, tokens, calm motion, no layout shift.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: list, preview, restore (confirm new version
appears, nothing lost), label, empty. Evidence + a mobile re-drive.

## ACCEPTANCE CRITERIA
- [ ] Timeline shows label/who/when/diff-summary; original is marked + protected.
- [ ] Preview is read-only; restore is **non-destructive** (creates a new version) with reassuring copy.
- [ ] Save + label work via the seam; empty state designed.
- [ ] Meets the mobile benchmark; ≤250 lines/component; `tsc`+`build`+tests green.

## DEPENDENCIES
- **L7** (versions seam + diff summaries + protected original). Build against the seam;
  adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/version-history` → merge → delete.
Restore must never read as destructive — the entire emotional point is safety.

## REFERENCES
- L7 versions seam; Vision 09 + Feature 24 PDFs in `zip_extracted/…`
- `docs/prompts/L7-…activity-versions.md`, `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §11
