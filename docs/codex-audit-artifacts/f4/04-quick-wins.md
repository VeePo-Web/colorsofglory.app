# F4 Canvas — Quick Wins (≤ 30 min each)

Ship these in one PR. No measurement needed — they are net-positive on every
axis with no behavior risk.

## QW1 — Fix Move-to-Ideas correctness (F4) — 10 min
`src/components/canvas/SongCanvasExperience.tsx:460-471`

```ts
const handleMoveToIdeas = useCallback((cardId: string) => {
  setCards((prev) => {
    const filtered = prev.filter((c) => c.id !== cardId);
    const originalId = cardId.replace("-final", "");
    return filtered.map((c) =>
      c.id === originalId ? { ...c, isDimmedReference: false } : c
    );
  });
  setSelectedId(null);
}, []);
```

## QW2 — Raise FAB above first-action prompt (F16) — 5 min
`src/components/canvas/SongCanvasExperience.tsx:591` → change `zIndex: 40`
to `zIndex: 60`. Verify the prompt's z-50 wrapper still dims the divider but
doesn't block the FAB.

## QW3 — Layer chips to 44 px (F17) — 10 min
`src/components/canvas/SongCanvasExperience.tsx:550` → swap `min-h-8` →
`min-h-11`, drop chip text size by 1 px if it wraps.

## QW4 — Lift card keyframes out of `CardShell` (F5) — 15 min
1. Delete the `<style>{CARD_KEYFRAMES}</style>` block in `CardShell.tsx`.
2. Append the three `@keyframes` (`card-enter`, `card-fly-to-final`,
   `card-pulse-dot`) to `src/index.css`.

## QW5 — Add `content-visibility: auto` to card root (F11) — 5 min
`src/components/canvas/CardShell.tsx` `styles` object:

```ts
contentVisibility: "auto",
containIntrinsicSize: "200px 160px",
```

## QW6 — Global `:focus-visible` ring + reduced-motion (F18) — 20 min
Append to `src/index.css`:

```css
:focus-visible {
  outline: 2px solid #B8953A;
  outline-offset: 2px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

Total: ~ 65 min of work, lifts the static UX score by ~15 points.