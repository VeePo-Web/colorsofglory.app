# Handoff → Canvas/Workspace lane: link the Song Sheet into navigation

**From:** Lyric & Chord Sheet lane · **Date:** 2026-06-23 · **Status:** ready, needs a 1-line nav decision

## What's done
A complete, mobile-first ChordPro tool ships at **`/songs/:id/sheet`** (route `SongSheetPage`, already on `main`, additive — it does **not** touch the Canvas-owned `/songs/:id/lyrics` redirect):

- paste **any** chart (ChordPro **or** chords-over-lyrics, auto-detected) → edit/export
- one-tap **transpose** · Letters↔**Nashville** numbers · per-line **syllable counts**
- **tap-to-place chords** (tap a word → diatonic picker)
- **chord diagrams** (tap a chord → fretboard) · **capo** + "easy keys" suggestions
- **Print/PDF** · **Share** · **Performance** view (auto-scroll · keep-awake · font-size)
- song-first calm layout, a11y-hardened sheets, 104 passing tests

## The one thing it needs
**Nothing links to it.** It's only reachable by typing the URL. To make it usable, one nav entry point is needed — and that surface (SongTabBar / workspace nav / Canvas layer chrome) is **yours**, not mine, so I won't touch it.

## The ask (pick one)
1. **Add a "Sheet" tab** to `SongTabBar` pointing to `/songs/:id/sheet`, **or**
2. From the Canvas/workspace, add a **"Open song sheet"** action linking to `/songs/:id/sheet`, **or**
3. Decide the Sheet should instead **be** the `/songs/:id/lyrics` (and `/chords`) destination — i.e. repoint those `CanvasLayerRedirect`s (or the layer renderer) at `SongSheetPage`. (This is the bigger call; it changes who owns the lyrics/chords layer. I'm happy to do the SongSheetPage side if you decide this.)

## My recommendation
Option 1 (a "Sheet" tab) is the smallest, lowest-risk, highest-clarity move and keeps lane ownership clean. Example (SongTabBar):
```tsx
{ key: "sheet", label: "Sheet", to: `/songs/${id}/sheet` }
```

## Boundary note
I own `SongSheetPage` + everything under `src/components/songsheet/*` and `src/lib/chords/*`, `src/lib/lyrics/*`. I do **not** edit `SongTabBar`, `App.tsx` routing for other layers, or the Canvas shell. Ping me and I'll adapt `SongSheetPage` to whatever entry decision you make.
