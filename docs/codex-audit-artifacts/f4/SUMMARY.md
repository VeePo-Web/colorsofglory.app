# F4 Canvas — Audit Summary

**Route:** `/song/:id/canvas` · **Files in scope:** 11 components, 1 hook, 2
lib files · **Date:** 2026-06-05 · **Mode:** Static (Codex to extend with
runtime traces).

## Instant-Feel Score (static estimate)

**62 / 100**

Weighted by perf scenarios that map to "instant" perception:

| Scenario | Weight | Static estimate | Why |
|---|---|---|---|
| P3 Pan 60fps | 20 | 13/20 | F1 listener re-bind + F14 layout read |
| P5 Tap card INP<100ms | 20 | 9/20 | F2 un-memoized cards dominate |
| P6 Drag card 60fps | 20 | 4/20 | F12 — drag doesn't fully work yet |
| P7 Hold-record mic | 15 | 12/15 | No issues found in static read |
| P2 Hot navigate | 10 | 7/10 | F9 dual lazy chunks |
| Others (P1, P4, P8-12) | 15 | 17/15 | Mostly green statically |

Codex will overwrite with measured values.

## Top 5 fixes (do in order)

1. **F2** — render the existing memoized `LyricCard`/`HumCard`/…
   instead of the inline `CanvasCardEl`. Single biggest gain.
2. **F4** — fix `handleMoveToIdeas` double-`setCards` bug (correctness).
3. **F1** — pin `useGesture` native listeners once (gesture-end jank).
4. **F12** — `setPointerCapture` + wire real card drag on the memoized
   cards. Must follow F2.
5. **F6** — replace transitioning `box-shadow` with opacity-swapped pseudo
   element (paint cost at scale).

## How to run the dynamic pass

```bash
# 1. Start the app
bun dev

# 2. In another terminal
bash scripts/codex/run-f4-audit.sh

# 3. Open docs/codex-audit-artifacts/f4/traces/ and load each into Chrome
#    DevTools Performance tab. Codex appends a "Measured" section below.
```

## Measured (Codex) — pending

_To be filled by Codex after running `scripts/codex/run-f4-audit.sh`._

- [ ] P1 Cold load LCP
- [ ] P2 Hot navigate
- [ ] P3 Pan 60fps
- [ ] P4 Pinch zoom 60fps
- [ ] P5 Tap card INP
- [ ] P6 Drag card 60fps
- [ ] P7 Hold-record mic prompt
- [ ] P8 Add 50 cards
- [ ] P9 Long-song scroll
- [ ] P10 Memory after 5 min
- [ ] P11 Reduced motion
- [ ] P12 Re-render storm