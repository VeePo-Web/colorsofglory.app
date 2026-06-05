# Feature 4 — Song Whiteboard Canvas Audit

This folder holds the audit artifacts for Feature 4 (Song Whiteboard Canvas at
`/song/:id/canvas`). It is co-authored by two agents:

- **Lovable** (static pass) — wrote `00-inventory.md`, `01-static-perf-findings.md`,
  `02-static-ux-findings.md`, `03-prioritized-fixes.md`, `04-quick-wins.md`,
  and the static portion of `SUMMARY.md`. Source-only, no runtime traces.
- **Codex** (dynamic pass) — extends this folder with `traces/`, `heap/`, and
  `screenshots/`, then updates `SUMMARY.md` with the measured Instant-Feel Score.
  Driven by `scripts/codex/run-f4-audit.sh` + `scripts/codex/f4-scenarios.md`.

## Reading order

1. `SUMMARY.md` — one page, top 5 fixes, score.
2. `03-prioritized-fixes.md` — what to ship first.
3. `04-quick-wins.md` — ≤30 min each, do these today.
4. `01-static-perf-findings.md` + `02-static-ux-findings.md` — full evidence.
5. `00-inventory.md` — reference map of the canvas surface.

## How Codex extends this

After running `scripts/codex/run-f4-audit.sh`:

```
docs/codex-audit-artifacts/f4/
  traces/P1-cold-load.json … P12-rerender-storm.json
  heap/t0.heapsnapshot … t5.heapsnapshot
  screenshots/Pn-*.png
```

Codex then appends to `SUMMARY.md` under `## Measured (Codex)` with real
numbers per scenario and re-scores the Instant-Feel total.

## Scope reminder

- In scope: `src/components/canvas/**`, `src/hooks/useGesture.ts`,
  `src/lib/canvas/**`, `src/pages/SongCanvasPage.tsx`, the canvas route chunk.
- Out of scope: backend, auth, payments, other pages.
- No source files were modified by this audit. Fixes are Claude Code's domain.