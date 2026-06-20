# C1 — CLAUDE: Canvas Cleanup (the "weird" one)
## Cluster 2 · Lane: `claude/*` · Owner: Claude (the experience) · Persona: Claude Mythos Fable 5 (`/feature`)

> Run this with the `/feature` 7-Phase loop. It is a **restructure**, not a rebuild
> from zero — the canvas works but is tangled. Frontend only; tokens only; consume
> data through the seam (`src/integrations/cog/*`), never the raw Supabase client.

---

## YOUR ROLE (do not overstep)

You are **Claude**, owner of the experience: all `src/` UI, components, copy,
animation, UX flows, design tokens. You do **not** touch Supabase schema/RLS/edge
functions (Lovable) or write the QA suite (Codex). You only ever *call* the typed
seam at `src/integrations/cog/*`. Contract: `docs/BUILD-PATHWAY.md`.

---

## CONTEXT

The Song **Whiteboard Canvas** is the advanced, non-linear songwriting surface:
a root song card branching into **idea cards** (voice/lyric/chord/note), arranged
on a board, organized into **sections**, with an **Ideas Tree → Final Tree** flow.
Spec + reference images:
- `zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/COG_Feature_04_Song_Whiteboard_Canvas_UX_Build_Handoff.pdf`
- `zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/COG_Feature_05_Ideas_Tree_and_Final_Tree_UX_Implementation_Plan.pdf`
- `zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/` (Product 01–14 PDFs + reference images)

It currently *works* but is structurally weird. The capture flow is the gold
standard to match for craft.

---

## THE AUDIT (what's actually wrong — confirmed)

1. **God component.** `src/components/canvas/SongCanvasExperience.tsx` is ~900 lines
   doing 6+ jobs: whiteboard rendering, six layer hosts (room/lyrics/voice/chords/
   notes/people), the recording flow, practice launch, and voice review.
2. **Two competing card data models:**
   - `src/lib/canvas/canvasTypes.ts` → `IdeaCard` / `CanvasNode` / `CanvasEdge`
     (zones, edges, object types — the ambitious model).
   - `SongCanvasExperience.tsx` (line ~53) → its own local `CanvasCard`
     (`tree: ideas|final`, x/y, accent, status). The two are adapter-glued and drift.
3. **Mock persistence.** `src/lib/canvas/canvasLoader.ts` stores node positions in
   `sessionStorage` and loads only `voice_memos` as ad-hoc `db-voice-*` cards. The
   real tables Lovable built (`canvas_cards`, `song_sections`, `song_lyrics`,
   `chord_progressions`, `song_notes`) are **not** wired in.
4. **Seam violation.** `canvasLoader.ts` imports `@/integrations/supabase/client`
   directly — UI/lib reaching past the seam. Must go through `integrations/cog/*`.
5. **Concept overload.** `/canvas` is both the whiteboard *and* the tabbed workspace
   shell (layers), with `CanvasLayerRedirect` in `App.tsx` sending `/lyrics`,
   `/chords`, `/voice`, `/notes`, `/people` to `/canvas?layer=…`. Whiteboard and
   workspace-shell are two different ideas crammed into one route+component.

---

## OBJECTIVE

A **coherent, maintainable canvas** that (a) runs on **one** data model, (b) reads/
writes through the **seam** to the **real** schema, (c) is split into focused
components (< ~250 lines each), and (d) delivers a crisp **MVP** of the F4/F5 spec
at capture-level craft — deferring the parts that aren't ready, explicitly.

---

## PHASE 0 — SPEC (do first)
Read the F4 + F5 PDFs and the `4. SONG WRITING CANVAS/` reference images. Then write
a one-paragraph **Canvas MVP scope**: the smallest version that nails the core
moment (root song → idea cards branch off it → drag to arrange → group into
sections → promote toward a Final tree). Explicitly list what's **deferred** (e.g.
edges/suggestions/review groups/merge-splice) so the surface isn't carrying dead
ambition. The reference image wins over the PDF on conflict.

## PHASE 1 — DISCOVER
Map the full canvas surface: `src/components/canvas/*`, `src/lib/canvas/*`,
`src/pages/SongCanvasPage.tsx`, `src/integrations/cog/canvas.ts`, and how `App.tsx`
routes layers. Confirm the two-model split and every consumer of each.

## PHASE 2 — AUDIT (7 lenses)
Extend the audit above through all 7 lenses (functional/UX/visual/a11y/perf/faith-
tone/edge). Pay special attention to **drag performance** (transform-only, RAF),
**reduced-motion**, **token compliance**, and **empty/first-run** state.

## PHASE 3 — SCOPE
Confirm with the user: (a) the Canvas MVP boundary, and (b) the **route model** —
is `/canvas` the whiteboard only, with the workspace **layers** as their own
screens/routes? Recommend separating the two concepts. Get a decision before the
big refactor.

## PHASE 4 — BUILD / FIX
1. **Unify the data model.** Make `canvasTypes.ts` the single source of truth.
   Delete the component-local `CanvasCard`; migrate the god component to the
   canonical types. One card shape, one node shape.
2. **Wire to real data via the seam.** Move all data access behind
   `src/integrations/cog/canvas.ts`. Remove the direct `supabase` import from
   `canvasLoader.ts`. Load `canvas_cards` + `song_sections` + child content from the
   real schema (per **L1's canonical capture→song data flow**). *Depends on L4
   (canvas persistence API);* until L4 lands, define the exact seam function
   signatures C1 needs and code against them with a thin adapter.
3. **Persist positions in the DB**, not `sessionStorage` (via `canvas_cards`
   x/y through the seam). Keep an optimistic local cache for drag smoothness only.
4. **Split the god component** into focused pieces, each < ~250 lines, e.g.:
   `CanvasShell` (route/header/nav) · `CanvasBoard` (the whiteboard + drag) ·
   `CanvasCardRenderer` (switch over card types → existing LyricCard/VoiceMemoCard/
   ChordCard/NoteCard/HumCard) · extract the recording flow into the existing
   capture components rather than re-implementing it here.
5. **Resolve the overload** per the Phase 3 decision (whiteboard vs workspace shell).
6. **Polish to capture-level craft:** COG tokens, serif titles, gold accents,
   radial glow, motion system, all five interactive states, 44×44 targets,
   reduced-motion, clean first-run/empty state.

## PHASE 5 — VERIFY
`npx tsc --noEmit` (0) · `npx vite build` (ok) · relevant tests green · walk the
canvas happy path + top-2 failure paths (no data; drag while loading). Paste
evidence. State what needs a real device/L4 to fully verify.

## PHASE 6 — REPORT & SHIP
Status before→after, root causes w/ `file:line`, what's deferred, what needs L4.
Commit on `claude/canvas-cleanup` → rebase → merge to `main` → delete branch, under
the Concurrent-Tree Git Protocol (stage by path, never `-A`; never force-push a
collaborator branch).

---

## DELIVERABLES
1. **Canvas MVP scope doc** (in-scope vs deferred) — `docs/canvas-mvp-scope.md`.
2. One unified canvas data model (`canvasTypes.ts`); the local `CanvasCard` removed.
3. Seam-only data access; no raw `supabase` import anywhere under `src/lib/canvas` or `src/components/canvas`.
4. DB-backed node positions (no `sessionStorage` source of truth).
5. `SongCanvasExperience` decomposed into ≤4 components, each < ~250 lines.
6. The seam-function contract C1 needs from L4 (handoff to Lovable).

---

## ACCEPTANCE CRITERIA
- [ ] Exactly one canvas card/node type across the whole canvas.
- [ ] No `@/integrations/supabase/client` import in `src/components/canvas/*` or `src/lib/canvas/*`.
- [ ] Node positions persist through the seam (survive reload without `sessionStorage`).
- [ ] No component in the canvas exceeds ~250 lines.
- [ ] Canvas renders real `canvas_cards`/`song_sections` data (or the defined adapter until L4).
- [ ] Matches the F4/F5 MVP scope; deferred items are documented, not half-built.
- [ ] `tsc` clean · `vite build` green · tests green · 7-lens pass.

---

## DEPENDENCIES
- **L1** — canonical capture→song data flow + table truth (consume it).
- **L4** — canvas/song-sections persistence + commit API via the seam (C1 defines
  the signatures it needs; build against the adapter until L4 ships).

## CONSTRAINTS
- Frontend only · tokens only (`var(--cog-*)`) · seam only · no `console.log`.
- iOS-Safari-first; drag must be smooth on mobile (transform/opacity, RAF).
- `/feature` 7-Phase loop; evidence before "done."

## REFERENCES
- `src/components/canvas/*`, `src/lib/canvas/*`, `src/pages/SongCanvasPage.tsx`, `src/integrations/cog/canvas.ts`
- F4: `…/3. System operations/COG_Feature_04_Song_Whiteboard_Canvas_UX_Build_Handoff.pdf`
- F5: `…/3. System operations/COG_Feature_05_Ideas_Tree_and_Final_Tree_UX_Implementation_Plan.pdf`
- Canvas suite + images: `…/4. SONG WRITING CANVAS/`
- `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §3/§5, `persona-songwriter-engineer.md`
