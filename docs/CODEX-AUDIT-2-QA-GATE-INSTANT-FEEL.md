# Codex Audit 2 - QA Gate v1 + Instant-Feel Pass

Date: 2026-06-04  
Branch audited: `codex/codex-operating-plan`  
Remote repo: `VeePo-Web/colorsofglory.app`  
Gate command: `npm.cmd run qa:codex`

## Scope

This audit turns Codex from an occasional reviewer into a repeatable quality gate for Colors of Glory. The gate now checks:

- lint
- production build
- full test suite
- bundle budgets
- production preview route smoke
- 390px mobile render smoke
- old-brand content scan
- basic accessibility source checks
- instant-feel source checks
- placeholder route scan

## Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run qa:codex` | Pass | Hard checks passed |
| `npm.cmd run lint` | Pass | 0 errors, 4 inherited shadcn fast-refresh warnings |
| `npm.cmd run build` | Pass | Production build completed |
| `npm.cmd run test` | Pass | 4 files, 12 tests passed |
| `npm.cmd run perf:budget` | Pass | All current bundle budgets passed |
| Old-brand content scan | Pass | No forbidden old-brand content in `src`, `public`, or `index.html` |
| Legacy asset filename scan | Warn | 15 old asset filenames remain under `src/assets` |
| 390px mobile render smoke | Pass | Catalog, workspace, capture, saved memo, upgrade, and 404 route covered through tests |
| Production preview route smoke | Pass | 20 SPA routes returned HTTP 200 |
| Placeholder route scan | Pass | No reachable `coming soon` placeholder files detected |
| Basic accessibility source checks | Pass | Head metadata, route fallback label, 404 heading, and key form labels detected |
| Instant-feel source checks | Pass | Route lazy-loading, skeleton fallback, stable card/touch target signals detected |

## Bundle Snapshot

- Main JS: `308.9 kB` raw, `99.7 kB` gzip
- Main CSS: `80.5 kB` raw, `14.6 kB` gzip
- Route chunks checked: `31`
- Largest route chunk: `PeoplePage`, `6.0 kB` raw

Current bundle shape is healthy. The main JS budget has roughly 10 kB gzip of headroom before it hits the current Codex cap, so audio, editor, transcription, and canvas work must stay lazy-loaded.

## Findings

### P1 - True Browser UX Metrics Are Not Automated Yet

The new gate checks route health and 390px React render smoke, but it does not yet measure real browser layout shift, tap latency, screenshots, Lighthouse, LCP, INP, or CLS. This is the next missing layer before Codex can call the UX truly world-class under pressure.

### P2 - Legacy Asset Filenames Still Exist

No old-brand content is leaking into app/public source, but the gate found 15 legacy filename hits under `src/assets`, including `veepo-logo.png`, `hero-drone.jpg`, and old case-study image names. These are not currently user-facing failures, but they should be deleted or quarantined before release.

### P2 - Warning Noise Should Be Burned Down

The gate passes with warnings:

- 4 shadcn fast-refresh lint warnings
- stale Browserslist/caniuse data
- ambiguous Tailwind `ease-[cubic-bezier(0.16,1,0.3,1)]` warning
- React Router v7 future-flag test warnings

Warnings are acceptable during buildout, but release-candidate gates should be quieter so real regressions stand out.

### P2 - Backend Integration Will Need A Second Instant-Feel Pass

Current route shells are light and fast. Once Lovable wires Supabase data, payments, storage, invites, memos, and activity logs, Codex must retest loading, empty, error, offline, slow-network, and optimistic states. The current pass validates the frontend shell, not the fully live product under real data pressure.

## What Passes Right Now

- Routes are code-split.
- Main bundle remains under budget.
- No visible `coming soon` route placeholders were detected.
- No old-brand content was detected in app/public source.
- The app has a branded 404.
- The app has a skeleton route fallback instead of a spinner-only transition.
- The current mobile-first shells render at the primary 390px QA width.

## What Claude/Lovable Should Fix Before Codex Re-tests

1. Delete or quarantine legacy assets under `src/assets` that are no longer used by Colors of Glory.
2. Keep all audio, transcription, editor, and canvas dependencies out of the root bundle.
3. Add explicit loading, empty, error, offline, and slow-network states as backend data is connected.
4. Clear warning noise before the first release-candidate gate.
5. Add a true browser/Lighthouse path for screenshot, CLS, LCP, INP, and tap-response verification.

## Current Codex Verdict

The current app shell passes Codex QA Gate v1 and feels safe to keep building on. The next quality risk is not raw bundle size; it is live-state polish once backend data and heavier songwriting features arrive.
