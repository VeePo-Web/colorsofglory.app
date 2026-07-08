# E3 · Version History — Progress

## 2026-07-07 — Steps 1–9 landed in one pass (build-from-schema)

**What changed**

- **Route + page (Steps 1, 3):** `/songs/:id/versions` added to `src/routes/songRoutes.tsx`
  (lazy, `RequireAuth`, E3 comment — filed with A5). `VersionHistoryPage.tsx` rebuilt from the
  "coming soon" stub: warm frame kept, glow added, timeline + save action + undo bar wired.
- **Data seam (Step 2):** `src/integrations/cog/versions.ts` — `listVersions` / `getVersion` /
  `createSnapshot` / `restoreVersion` / `ensureOriginalVersion` / `captureCurrentState`, plus
  the pure snapshot codec (`parseSnapshot`, `summarizeSnapshot`, `findOriginalId`). Snapshot v1
  = `{ v:1, song:{title}, sheet: SheetDoc|null }`. `SongVersion` consumed from `@/types`
  (A2 had already surfaced it — generated row, canonical home `src/types/version.ts`). No raw
  `song_versions` queries outside the seam.
- **Timeline (Step 3):** `VersionTimeline.tsx` — newest-first cards on a gold spine: `vN`,
  kind-tinted headline (label-first), what-it-held line (sections · lines · chords), actor
  chip (initials + avatar_color + name), relative time, gold shield **Original** badge.
- **Detail sheet (Step 4):** `VersionDetailSheet.tsx` on `VersionSheetShell.tsx` — a shared
  bottom-sheet shell in the canvas sheets' visual language but with a REAL focus trap (the
  canvas sheets only had Escape + autofocus): focus moves in, Tab cycles, Escape dismisses,
  focus returns to the opener. Summarizes the snapshot (stats, key/BPM, section list) — never
  raw JSON; unreadable snapshots get a calm fallback.
- **Restore (Steps 5, 8):** `restoreVersion` = preserve-first ("Before restoring vN", kind
  `auto`, parent = head) → apply sheet via `saveSongSheet` → record `restore_point`
  (parent = restored version, label "Restored from vN"). `RestoreConfirmSheet` with protective
  copy; undo bar after restore ("Your previous version is safe as vN") — **Undo is just a
  restore of the pre-restore version**, same non-destructive path.
- **Original (Step 6):** auto-seeded on first can-write visit (`ensureOriginalVersion`,
  race-safe), detected by lowest `version_number` (FK-null-proof), shield-badged, one-tap
  "Return to the original" button, no delete anywhere in the UI or the seam.
- **Save a version (Step 7):** header CTA → `SaveVersionSheet` (optional label, Enter-to-save)
  → `createSnapshot(kind: manual)` → timeline refreshes via query invalidation.
- **Gating + states (Step 9):** `useVersionCapabilities` (interim E1 seam over
  `cog/members.myRole`): owner/collaborator save+restore, viewer read-only (no CTA, no restore
  buttons). Single-version state shows "Just the original so far — every save lives here";
  zero-version viewer state is warm; reduced-motion disables sheet animations; aria-live on
  statuses; cards/buttons keyboard-reachable.

**Verified**

- `npx tsc --noEmit` clean; `npx vite build` green (VersionHistoryPage code-split into its own
  chunk); new `src/test/version-history.test.ts` — 11/11 passing (codec round-trip, calm
  rejection of unreadable snapshots, summary counts, minor-key rendering, Original detection
  incl. nulled-parent chains, headline copy).
- Full vitest: 337 passed; the 11 pre-existing failures are other lanes' (design-guard flags
  `components/activity/useActivityFeed.ts` + `components/ui/glow.tsx`; seo test wants
  `/onboarding/intent`; sheet-doc/feature04/codex-mobile-render reference C3/D code) — none
  touch E3 files.

**Still open (Step 10 remainder)**

- Live-session end-to-end (save → restore → preserve → undo against real Supabase auth) not
  yet driven — needs an authed browser session; the restore orchestration is exercised at the
  seam + type + pure-logic level.

**Dependencies filed / consumed**

- A2: `SongVersion` consumed from the barrel (already existed). A3: version API filed AND
  implemented in-lane per the notes-seam precedent. A5: route added in `songRoutes.tsx` with
  lane comment. E1: interim capability hook, collapse when `useCapabilities` ships. E2:
  `version_saved`/`version_restored` kinds documented, client emit is a safe no-op; DB trigger
  already bumps activity. Contract: `docs/VERSION-CONTRACT.md`.

## 2026-07-08 — Ported to the reset tree + committed/pushed

The working tree was reset to a different lineage mid-session (Lovable-driven history; the
sheet seam `cog/sheet.ts`, `cog/errors.ts`, the `@/types` barrel, `lib/notes/relativeTime`,
and the first `versions.ts`/`useSongVersions.ts` were gone; the five sheet components
survived untracked). E3 was re-ported onto the new structure:

- **Snapshot v1 is now rows-based** (`{v:1, song:{title}, sections:[{id, kind, label,
  position, lyrics:{content, plain_text}|null}]}`): `song_sections` + `song_lyrics` captured
  verbatim, `content` opaque Json — editor-agnostic and lossless. Restore upserts/removes rows
  to match the snapshot. Restore law unchanged (preserve-first → apply → restore_point).
- **`SongVersion` lives in the seam** (no `@/types` barrel in this tree); `CogError` comes
  from `cog/songs.ts`; `relativeTime` is a lane-local copy in `components/versions/`.
- **Gating stays on the interim `myRole` hook** — E1's `useCapabilities` was present but
  incomplete (`@/types/role` missing) at port time; collapse later per contract §5.
- **Route:** A5's regenerated `src/routes/songRoutes.tsx` already carries
  `/songs/:id/versions` → nothing to add from E3.
- **Verified:** `tsc -p tsconfig.app.json` — zero errors in E3 files (remaining 8 errors are
  other lanes': E1 `@/types/role` × 4, pre-existing test-file errors × 4); `vite build` green
  with `VersionHistoryPage` code-split; `src/test/version-history.test.ts` 12/12.
- **Committed** E3 files only (`git commit --only`) and pushed to
  `https://github.com/VeePo-Web/colorsofglory.app` (main).
