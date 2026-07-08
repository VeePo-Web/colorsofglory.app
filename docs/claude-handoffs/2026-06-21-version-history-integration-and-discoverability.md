# Handoff: Version History — integration + discoverability

**From:** Collaboration & Song Memory lane (5th Claude)
**Date:** 2026-06-21
**Branch / PR:** `feat/collab-song-memory-version-history` (pushed)
**Status:** UI built + tested + committed. Three integration items below are owned by other lanes / backend,
so the surface ships behind them.

The Version History page (`src/pages/VersionHistoryPage.tsx`, route target `/songs/:id/versions`) and its
typed contract (`src/integrations/cog/versions.ts`, on the real `song_versions` table) are done and unit-tested.
For users to actually reach and fully use it, three things outside my lane need to land:

## 1. Route wiring in `App.tsx` (owner: whoever next commits App.tsx)
My route line is **live in the working tree but intentionally NOT in my commit** — `App.tsx` currently carries
the Admin lane's uncommitted WIP (`AdminWebhookOpsPage` / `AdminPayoutBatchesPage`), and the Concurrent-Tree
Protocol forbids absorbing it. When `App.tsx` is next committed cleanly, include these two lines (already present
locally):

```tsx
// with the other song-page lazy imports:
const VersionHistoryPage = lazy(() => import("./pages/VersionHistoryPage"));

// with the other /songs/:id/* routes:
<Route path="/songs/:id/versions" element={<RequireAuth><VersionHistoryPage /></RequireAuth>} />
```

## 2. Discoverability entry point (owner: Canvas / Song-Workspace lane)
`/songs/:id/versions` has **no entry point** today — the song interior is your layer system
(`SongCanvasPage` + `?layer=`), which I deliberately did not touch to avoid a clash. Please add a calm link into
Version History from the song shell. Suggested, in priority order:
- A quiet "Version history" item in the song overflow / "…" menu, **or**
- A small "Saved · view history" affordance near the lyrics/saved-state indicator (PV09 pairs history with the
  current draft).

Keep it gold-restraint, no badge/feed energy (PV09). It can deep-link straight to `/songs/:id/versions`.
If you'd prefer Version History become a `?layer=versions` panel instead of a standalone route, ping me and
I'll refactor `VersionHistoryPage` into a layer — I built it standalone only to avoid editing your shell
without coordination.

## 3. Server-side restore RPC (owner: Lovable)
Tracked separately in [`2026-06-21-restore-song-version-rpc.md`](./2026-06-21-restore-song-version-rpc.md).
Until it ships, Restore shows a calm "coming soon" and history stays fully readable. No frontend change needed
when it lands — the contract is wired and unit-tested (`isMissingFunctionError` drives the fallback).

## Nice-to-have (my lane, deferred until snapshot shape is known)
PV09's optional **Compare versions** drawer needs the `song_versions.snapshot` JSON shape (Lovable-defined).
Once that's documented, I can build compare entirely in my lane (no clash). Not blocking.
