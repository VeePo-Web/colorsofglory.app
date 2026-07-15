# "For…" — the Song Dedication · Progress

## 2026-07-14 — Shipped

An optional one-line dedication a song can quietly carry ("for the youth
night," "for the Sunday after Mom's surgery"). Offered once at song birth,
living as a muted italic "for …" line in the headers, riding into credits and
both exports. Meaningful when present, **genuinely invisible when empty**.

### The four hard requirements, as built

1. **Never blocks.** The offer renders only AFTER "Make it a song" fully
   commits (song created + idea claimed + shelf refreshed) — zero added taps
   anywhere in the capture critical path. It is a non-modal card on the
   catalog shelf area; everything else remains reachable around it.
2. **Offered once, gently.** The only birth-from-capture beat in the current
   app is the Ideas shelf's "Make it a song" (`SeedIdeaCard` →
   `onSongBorn` → `SeedIdeasShelf` hosts `DedicationOffer`). The offer marks
   itself seen (`cog-dedication-offered:<songId>`) ON MOUNT, so a re-render,
   reload, or return trip can never re-prompt. Skip is a muted underlined
   "Skip for now"; nothing is saved, nothing nags, ever. (Catalog "+ new
   song" and onboarding Screen 4 deliberately get NO offer — those are the
   "first creative breath" surfaces the placement rules protect.)
3. **Always editable later.** `DedicationLine` in the workspace header is the
   permanent home + edit surface: tap the line (or the barely-there "add a
   dedication" affordance, workspace-only) → a single inline input → Enter/
   blur saves, Escape cancels, empty clears. Role-gated to non-viewers; the
   server stays the real gate.
4. **Invisible when empty.** Every surface inherits the "Key · BPM IF
   available" grammar: workspace header, sheet header, catalog card
   (comfortable density only), credits page, sheet print/PDF, and the
   credits text export all render NOTHING when unset.

### The save (pure, unfailing)

`src/lib/songs/dedication.ts` — offline-first device store + server sync:
optimistic local write → best-effort `setSongDedication` → retries on app
load + `online`. Never throws, never toasts an error, never blocks; a cleared
dedication keeps a local tombstone so a stale server prop can't resurrect it,
and this device's fresh edits outrank stale snapshots for 5 minutes while
server-remembered values always yield to newer server truth (collaborator
edits/clears converge). "Pure local text" reconciled: persisted to the SONG
(shared, survives device change), offline-first — simple + unfailing, not
localStorage-only. A strictly private/device-local variant would be a
one-line swap (skip the server sync; the store already is that variant).

### Back-end ask (Lovable)

- `ALTER TABLE songs ADD COLUMN dedication text` (nullable; client soft-caps
  at 200 chars — a DB CHECK is optional).
- `create-song` edge fn: accept + insert optional `dedication`.
- `get_song_detail` + `list_my_songs` RPCs: return `dedication`.
- Regenerate `types.ts` (the client already threads `dedication` through
  songs Row/Insert/Update, `SongDetail`, `SongCard`, `createSong`).
- RLS: confirm collaborators (not just owners) may update the column, mirroring
  tempo/key. Until the column lands, the direct update fails quietly and the
  device store keeps the text pending (the author still sees their line);
  everything heals when the column ships.

### Files

- NEW `src/lib/songs/dedication.ts` (+ tests) — store/sync/normalize/hook.
- NEW `src/components/capture/DedicationOffer.tsx` (+ tests) — the birth offer.
- NEW `src/components/cog/DedicationLine.tsx` — display + edit line.
- `SeedIdeaCard` / `SeedIdeasShelf` — `onSongBorn` seam + offer hosting.
- `SongWorkspacePage` (edit home) · `SongSheetPage` (line + print top-line) ·
  `SongGridCard` (display-only subtitle) · `CreditsPage` + `creditsToText`
  (top-line above the ledger, in the copy-out export).
- `cog/songs.ts` — `dedication` on SongDetail/SongCard/createSong +
  `setSongDedication`; `types.ts` songs Row/Insert/Update.

### Verification

15 unit/component tests green (normalize, optimistic save, failed-sync retry,
clear→invisible, stale-prop resurrection guard, collaborator clear
convergence, export top-line/omission, offer once-marker/save/skip/disabled-
empty, line invisible-empty/add-affordance/edit/clear/viewer-read-only).
`tsc --noEmit` clean · `vite build` green · capture/catalog/canvas suites
green. Tone: Inter, muted warm-gray italic, never gold, no box/divider, no
hearts/kitsch; offer copy is an invitation ("Who is this song for?") with a
weightless skip.

**Needs a hands-on pass:** birth a song from an idea on a phone and feel the
offer beat; confirm the header line edit + print output visually.
