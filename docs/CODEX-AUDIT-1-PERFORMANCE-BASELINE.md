# Codex Audit 1 - Performance Baseline

Date: 2026-06-03  
Branch audited: `codex/codex-operating-plan`  
Remote repo: `VeePo-Web/colorsofglory.app`

## Scope

This audit returns Codex to its lane after the first frontend/onboarding build and Lovable backend merge:

- build, lint, and test health
- route surface smoke checks
- old-brand/public metadata leak scan
- bundle shape and performance budget setup
- UX risks that threaten the "instant" product feel

## Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | 0 errors, 4 inherited shadcn fast-refresh warnings |
| `npm.cmd run build` | Pass | Vite build completed in about 10s |
| `npm.cmd run test` | Pass | 2 files, 5 tests passed |
| Old-brand grep | Pass | No old fly4me/drone route branding in `src`, `public`, or `index.html` |
| Production preview route smoke | Pass | Key SPA routes returned HTTP 200 |
| Browser automation | Blocked | `node_repl` still exits with Windows sandbox setup error |

## Current Bundle Shape

Latest production build:

- Main JS: `315.45 kB` raw, `101.75 kB` gzip
- Main CSS: `81.91 kB` raw, `14.93 kB` gzip
- Largest route chunk: `SongWorkspacePage`, `5.43 kB` raw, `2.13 kB` gzip
- Route code splitting is working; onboarding and workspace pages are not bundled as one giant route file.

New guardrail:

- Added `npm run perf:budget`.
- This reads `dist/assets` after `npm run build` and fails if the main JS, CSS, or route chunks exceed current performance budgets.

## Findings

### P1 - Placeholder Routes Are The Biggest UX Risk

The app has several reachable routes that render "coming soon":

- `/songs/:id/lyrics`
- `/songs/:id/voice`
- `/songs/:id/notes`
- `/songs/:id/people`
- `/songs/:id/activity`
- `/songs/:id/credits`
- `/settings/storage`
- `/settings/referral`

These do not break build health, but they do break the product illusion. Users can tap from the polished song room into placeholder screens. The next frontend slice should either build these as real calm shells or hide/disable the routes until the feature is ready.

### P1 - Browser/Visual Verification Still Needs A Working Tool Path

HTTP smoke checks pass, but full mobile visual verification is blocked because the Node REPL browser runtime exits with:

`windows sandbox failed: spawn setup refresh`

Until this is fixed, Codex can verify build/test/route/source/bundle health, but not final 390px visual layout through browser automation.

### P2 - Initial JS Is Acceptable But Already Worth Watching

The main JS gzip size is about `101.75 kB`. This is acceptable for the current shell, but it leaves limited headroom for audio, collaboration, and editor features.

Keep heavy dependencies out of the startup path. Current risk areas:

- global query/toast providers at app root
- shadcn UI component library present in repo
- future audio/editor/canvas packages could accidentally land in the main chunk

The new bundle budget should be run after every meaningful frontend slice.

### P2 - Build Warnings Should Be Cleaned Before Release Candidate

Current non-blocking warnings:

- Browserslist/caniuse data is stale.
- Tailwind reports an ambiguous `ease-[cubic-bezier(0.16,1,0.3,1)]` utility.
- shadcn UI files emit fast-refresh warnings.

These are not blocking today, but they should be cleared before a public release candidate so warning noise does not hide real regressions.

### P3 - Package Identity Is Still Template-Like

`package.json` still uses:

`"name": "vite_react_shadcn_ts"`

This does not affect runtime performance, but it is repo hygiene. Rename to a Colors of Glory package name before handoff.

## Recommended Next Codex Work

1. Run `npm run build && npm run perf:budget` after every feature slice.
2. Add Playwright or another reliable browser path once the local browser runtime is fixed.
3. Replace reachable placeholder routes with real mobile-first loading/empty shells.
4. Add route-level interaction tests for the first onboarding path.
5. Add CI checks for build, test, lint, and bundle budget once GitHub Actions is ready.

## Current Codex Verdict

The merged app is safe to keep building on. The first onboarding path is not yet production-complete, but its performance shape is healthy: code splitting works, old public branding is gone, and build/test gates pass.

The next quality threat is not raw speed yet. It is polish discontinuity: beautiful onboarding screens leading into placeholder routes.

