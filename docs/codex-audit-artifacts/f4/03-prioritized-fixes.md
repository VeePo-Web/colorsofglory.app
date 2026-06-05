# F4 Canvas — Prioritized Fixes

Ranked by `impact / effort`. Owner: Claude Code (canvas surface is in
Claude's domain per the 3-agent contract). Lovable does not edit `src/**`
outside `src/integrations/cog/*`.

| Rank | Finding | Impact | Effort | Risk | Why first |
|---|---|---|---|---|---|
| 1 | F2 — render memoized cards, kill `CanvasCardEl` | Huge (-50% INP at scale) | M (3-4 h) | Low (cards already exist) | Unlocks every other render fix |
| 2 | F4 — fix Move-to-Ideas correctness | High (bug) | S (15 min) | None | Visible regression today |
| 3 | F1 — pin gesture listeners once | High (drops gesture-end jank) | S (30 min) | Low | Touches one file |
| 4 | F16 — z-order: FAB above prompt | High (UX bug) | S (5 min) | None | Free win |
| 5 | F17 — 44 px layer chips | High (touch) | S (10 min) | None | Free win |
| 6 | F5 — lift card keyframes to `index.css` | Medium | S (10 min) | None | Easy, removes DOM noise |
| 7 | F6 — opacity-based shadow swap | Medium | M (1 h per card) | Low | Steady frame gain |
| 8 | F12 — `setPointerCapture` + real card drag | High (drag works) | M (2-3 h) | Medium | Needs F2 first |
| 9 | F11 — `content-visibility: auto` on cards | Medium | S (5 min) | Low | Helps zoom-out perf |
| 10 | F18 — focus ring + reduced-motion guard | Medium (a11y) | S (20 min) | None | WCAG gates |

## Sequencing notes

- Do **F2 before F12** — drag logic only makes sense once the memoized cards
  are the rendered ones.
- Do **F1 before profiling F3** — without F1 the trace will be dominated by
  listener re-bind noise.
- F6 (shadow swap) is the biggest visual code change; ship it once you have
  Codex traces confirming the paint cost.

## Out of scope (do not bundle in this round)

- Refactoring `useGesture` into multiple hooks.
- Replacing the `<style>{...}</style>` injection with a CSS-in-JS lib.
- Migrating to Framer Motion `LayoutGroup` for the cards.
- Adding a mini-map.

Those are future audits; sticking to the prioritized 10 is what gets the
canvas to "instant".