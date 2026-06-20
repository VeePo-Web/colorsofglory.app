# L4 — LOVABLE: Canvas / Song-Sections Persistence + Commit API
## Cluster 2 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. This is the durable backbone C1 (canvas cleanup) needs so the
> canvas can stop faking it with `sessionStorage`. Backend + the `cog/*` seam only.
> Songwriter truth: **a moved card, a named section, an arrangement — none of it may
> ever be lost.** The canvas is where the song is shaped; persistence is sacred.

## YOUR ROLE
Lovable: Supabase schema/RLS/migrations, edge functions, the typed `src/integrations/
cog/canvas.ts` seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Today the canvas reads `voice_memos` and stores node positions in **`sessionStorage`**
(`src/lib/canvas/canvasLoader.ts`) — positions vanish across devices/reloads, and it
imports the raw Supabase client (a seam violation C1 will remove). Real tables already
exist: `canvas_cards`, `song_sections`, `song_lyrics`, `chord_progressions`,
`voice_memos`, plus a `commit-take` edge function and `commitTakeToCanvas` in the SDK.
L1 defines the canonical capture→song data flow — implement persistence to match it.

## OBJECTIVE
A member-scoped, durable canvas data layer + a clean commit API, exposed through one
typed seam, so node positions, cards, sections, and the Ideas→Final flow persist
everywhere and C1 can delete `sessionStorage` entirely.

## TASKS
1. **Card persistence (`canvas_cards`):** CRUD + position (`x`, `y`, `zone`,
   `collapsed`, `width/height`), `objectType`/`objectId` linking to the underlying
   content (voice memo / lyric / chord / note / section). Member-scoped RLS.
2. **Position upserts (cheap + frequent):** a fast `updateCardPosition` path for drag —
   debounce/batch friendly; optimistic on the client, authoritative here. No full
   re-fetch needed after a drag.
3. **Sections (`song_sections`):** create / rename / reorder / delete; stable ordering;
   children (lyrics/memos) reference their section per L1.
4. **Commit API (Ideas → Final):** back `commitTakeToCanvas` properly — turn a take +
   its transcript blocks into idea cards, and promote idea → section/final per the F5
   two-tree model (Ideas Tree → Final Tree). Idempotent; preserves originals.
5. **Edges/relations (if in C1's MVP):** branch/reference/moved-to-final links between
   nodes — only what C1's MVP needs; defer the rest, documented.
6. **Realtime (optional, calm):** if collaborators share a canvas, support
   member-scoped realtime card updates (coordinate with L6) — but never noisy.
7. **The seam (`cog/canvas.ts`):** one typed surface C1 consumes — `loadCanvas(songId)`
   (cards + positions + sections + linked content), `upsertCard`, `updateCardPosition`,
   `deleteCard` (soft), `createSection`/`renameSection`/`reorderSections`, `commitTake`.
   Remove any need for the client to touch the raw Supabase client. Document it.

## DELIVERABLES
1. `canvas_cards` CRUD + positions + RLS. 2. Fast position-upsert path.
3. `song_sections` CRUD + ordering. 4. Idempotent commit (take→cards, idea→final).
5. Typed `cog/canvas.ts` seam (the exact functions C1 lists). 6. Soft-delete/restore.

## ACCEPTANCE CRITERIA
- [ ] Card positions/sections persist across reload + device (no `sessionStorage` truth).
- [ ] Drag persists via a cheap upsert; no full re-fetch; member-scoped RLS enforced.
- [ ] Commit (take→idea cards, idea→final) is idempotent and preserves originals.
- [ ] One typed seam covers everything C1 needs; client never imports the raw client.
- [ ] Soft-delete/restore; nothing on the canvas is ever truly lost.

## CONSTRAINTS
Backend + seam only. Never weaken RLS or expose service-role. Coordinate the seam
signatures with **C1**. `lovable/canvas-persistence` → merge → delete.

## REFERENCES
- `src/lib/canvas/canvasLoader.ts` (the sessionStorage mock to replace), `canvasTypes.ts`
- `src/integrations/cog/canvas.ts`, `supabase/functions/commit-take*`
- tables: `canvas_cards`, `song_sections`, `song_lyrics`, `chord_progressions`, `voice_memos`
- `docs/prompts/C1-claude-canvas-cleanup.md`, `L1-…schema-consolidation.md`
- F4/F5 PDFs in `zip_extracted/…/3. System operations/`; `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §5
