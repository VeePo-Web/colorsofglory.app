# A5 App Shell / Routing — Progress Log

> Note: an earlier agent run reported Steps 1–7 complete, but those edits were
> made in an ephemeral sandbox and never reached the real filesystem. This log
> records the **real** rebuild, done directly against the working tree and
> verified with a green `vite build`.

## Rebuild (2026-07-08) — verified against the real tree

**Starting reality (verified, not assumed):** A4's foundation was already
present and correct — `src/lib/queryClient.ts`, `AuthProvider`/`useAuth`
(`src/lib/auth/AuthContext.tsx`), `OutboxProvider`, `isPreviewUnlocked`, and a
`RequireAuth` that already consumes `useAuth` (no `supabase.auth` subscription,
no bypass). BottomNav was already fixed (Songs → `/songs`). There is **no**
`src/lib/motion/variants.ts` (A1) and **no** `useOnboardingStep` hook; the app
already has a richer spatial-entrance transition system.

### Step 1 — Route map
- Wrote `docs/ROUTE-MAP.md` from the real `App.tsx` + guard matrix; marked
  CLAUDE.md §4 superseded. Flagged the guard gaps + onboarding swallow.

### Step 2 — Route modularization
- Split the inline route list into `src/routes/{authRoutes,onboardingRoutes,
  songRoutes,settingsRoutes}.tsx` (joining the existing `AdminRoutes.tsx`).
- Removed the six duplicate admin routes that were inline in App.tsx AND in
  `AdminRoutes.tsx` (`{adminRoutes}` is now the single admin surface).
- App.tsx is now a lean provider + shell composition (~110 lines) spreading the
  five groups + legal + `*`. Preserved every path exactly, including the real
  page mappings: lyrics/chords/sheet → SongSheetPage (C3), voice → VoiceMemosPage
  (C4), versions → VersionHistoryPage (E3); only `/people` folds into the canvas.

### Step 3 — Providers
- Already composed by A4. Verified order, documented it in an App.tsx header
  block, kept the two overlays inside BrowserRouter after `<Routes>`.

### Step 4 — Auth boundary (guard gaps closed)
- Wrapped every previously-unguarded app surface in RequireAuth:
  `/songs/:id/{canvas,practice,capture-onboarding,voice-added}`, all four
  `/settings*`, and `/home`.
- Left genuinely public routes unguarded. `/albums/:albumId/practice` left
  unguarded pending a public-share decision (flagged in ROUTE-MAP).
- **Deep-link resume (real bug, fixed):** RequireAuth now stashes the full
  attempted path (`pathname+search`, so `?layer=` survives) in
  `sessionStorage["cog:return-to"]`; `routeAfterAuth` consumes it (priority 3,
  after checkout + invite) — survives the phone-OTP page hop that drops router
  `location.state`.

### Step 5 — Shell frame + unified skeleton
- Created `src/components/shell/BrandedSkeleton.tsx` — the ONE loading state,
  wired into both `<Suspense>` (deleted App.tsx's inline `RouteFallback`) and
  RequireAuth's `loading` branch (deleted its hardcoded-hex `Fallback`).
- Created `src/components/shell/AppShell.tsx` — the shared `--max-w-app` frame
  with glow + header/bottomNav slots. Available, not forced (pages that hand-roll
  their frame keep working).

### Step 6 — Nav chrome
- BottomNav Songs tab already targeted `/songs`; refined active-state so Songs
  stays lit across `/songs/:id*` interiors. Chrome stays badge-free; hub stays
  chrome-free.

### Step 7 — Transitions (documented, NOT replaced)
- The app already owns transitions via `src/lib/nav/navDirection.ts`
  (`useSpatialEntrance`) + `nav-enter-*` classes + reduced-motion + swipe nav —
  richer than a route-level AnimatePresence, which would double-animate and fight
  the swipe system. Documented the contract in `docs/APP-SHELL.md`; did not add a
  competing wrapper. The two overlays are outside `<Routes>` and never animate.

### Step 8 — Onboarding routing (swallow fixed)
- Rewrote `src/lib/auth/postAuthRoute.ts` with a typed exhaustive
  `Record<onboarding_step, …>` table over all 11 enum values. `referral_program_seen`
  → `/onboarding/earn` and `founder_code_seen` → `/onboarding/founder-code`
  (previously swallowed into `/songs/:firstSongId`, which broke when no song
  existed). In-song steps guard against a null song id.

### Step 9 — Orphans (documented, not deleted)
- The charter's orphan list is stale for the real tree: ActivityPage / CreditsPage
  / NotesPage / VoiceMemosPage / VersionHistoryPage are all actively routed;
  LyricsEditorPage does not exist. Only PeoplePage is truly zero-import, and it is
  tracked WIP from another group — not deleted on a production push. Redirects
  verified: `/invite/:token`→`/join/:token`, `/songs/:id/people`→canvas,
  `/auth`→`/auth/login`, `/pricing`→upgrade, `*`→branded NotFound.

### Step 10 — Verification
- **`vite build` green (exit 0, ~8s)** with all A5 changes; every route-group
  chunk present. Published `docs/APP-SHELL.md`.
- Repo `tsc` typecheck is red, but ONLY from pre-existing other-group WIP
  (`src/components/roles/*`, `src/lib/permissions/*`, and several `src/test/*`
  referencing a not-yet-created `@/types` barrel) — none in A5 files, none in the
  app entry graph, so the deploy build is unaffected. `node_modules` had to be
  repaired (`npm install`) first; it was missing `@alloc/quick-lru`.
