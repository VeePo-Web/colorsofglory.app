# Codex Audit 3 - QA Gate Cleanup

Date: 2026-06-04  
Branch audited: `codex/codex-operating-plan`  
Remote repo: `VeePo-Web/colorsofglory.app`  
Gate command: `npm.cmd run qa:codex`

## Scope

This pass tightens the existing Codex QA Gate v1 instead of adding product features. The goal was to remove easy release friction before the next heavier browser-metrics layer.

## What Changed

- Removed 15 unused legacy asset files that triggered old-brand filename warnings.
- Changed repeated arbitrary Tailwind easing classes to a named `ease-cog` token.
- Added React Router v7 future flags to the app router and mobile smoke test router.
- Narrowed the shadcn/ui React Refresh lint override to `src/components/ui/**`.
- Removed now-stale inline eslint-disable comments from shadcn UI files.
- Adjusted the QA runner's Windows process spawning so it no longer emits Node `DEP0190` warnings.

## Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run qa:codex` | Pass | Hard checks passed |
| `npm.cmd run lint` | Pass | 0 errors, 0 warnings |
| `npm.cmd run typecheck` | Pass | TypeScript app check completed with no errors |
| `npm.cmd run build` | Pass | Production build completed |
| `npm.cmd run test` | Pass | 4 files, 14 tests passed |
| `npm.cmd run perf:budget` | Pass | All current bundle budgets passed |
| Old-brand content scan | Pass | No old-brand content in `src`, `public`, or `index.html` |
| Legacy asset filename scan | Pass | Prior 15 filename hits removed |
| 390px mobile render smoke | Pass | Catalog, workspace, capture, saved memo, chords, settings, upgrade, and 404 covered |
| Production preview route smoke | Pass | 22 SPA routes returned HTTP 200 |
| Basic accessibility source checks | Pass | Expected source signals detected |
| Instant-feel source checks | Pass | Lazy routes, skeleton fallback, and stable-touch signals detected |

## Bundle Snapshot

- Main JS: `309.7 kB` raw, `99.9 kB` gzip
- Main CSS: `83.0 kB` raw, `15.1 kB` gzip
- Route chunks checked: `41`
- Largest route chunk: `PeoplePage`, `6.2 kB` raw

## Remaining Noise

The only remaining command-line warning is stale Browserslist/caniuse-lite data. Running `npx update-browserslist-db@latest` failed in this environment because the updater attempted to call `bun`, and `bun` is not installed. That is a package-manager/tooling issue, not an app-source issue.

## Next Codex Move

Codex QA Gate v2 should add true browser evidence: screenshot capture, Lighthouse/mobile lab metrics, CLS guard, route transition timing, and tap-response checks. The current repo does not include Playwright or Lighthouse dependencies yet, so that should be added as a deliberate tooling slice rather than hidden inside this cleanup.

## Current Codex Verdict

The app shell is cleaner than the previous pass: old-brand asset residue is gone from the gate, lint warning noise is gone, route smoke still passes, and bundle size remains inside budget. The next real risk is live browser behavior under heavier backend/audio/canvas states.
