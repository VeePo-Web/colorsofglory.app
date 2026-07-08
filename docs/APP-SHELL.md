# App Shell — provider composition, guards, frame & motion contract

The skeleton every screen hangs on. Owned by A5. Feature agents drop a screen
into a slot; they never rebuild the frame.

## Provider composition (single source of truth: `src/App.tsx`)

```
PasswordGate(isPreviewUnlocked)          // preview lock (A4 typed helper)
  → QueryClientProvider(queryClient)     // A4: src/lib/queryClient.ts
    → AuthProvider                       // A4: the ONE auth subscription
      → OutboxProvider                   // A4: offline-write outbox
        → TooltipProvider → Toaster/Sonner
          → BrowserRouter(v7 flags)      // v7_relativeSplatPath + v7_startTransition
            → PracticePlayerProvider
              → SongSurfaceTracker + RouteAnnouncer
                → Suspense(BrandedSkeleton) → <Routes>  // the 5 route groups
```

The two always-on overlays — `GlobalCaptureFlow` (capture FAB) and
`MiniPracticePlayer` — mount **after** `<Routes>` but **inside** `<BrowserRouter>`,
so they persist across navigation and never re-mount on route change.

Do not define `queryClient` / `AuthProvider` here — mount and consume A4's.

## The route → guard rule

Every real app surface is behind `RequireAuth`. Only genuinely public routes
(auth, onboarding, invite/join, pricing/checkout, legal, the branded 404) are
unguarded. Admin is behind `RequireAdmin`. See `docs/ROUTE-MAP.md` for the full
matrix.

### How to add a guarded route

Add it to the right fragment in `src/routes/*` (not App.tsx), wrapped:

```tsx
<Route path="/songs/:id/thing" element={<RequireAuth><ThingPage /></RequireAuth>} />
```

Lazy-import the page inside that fragment. App.tsx stays a lean composition.

## The frame contract — `AppShell`

`src/components/shell/AppShell.tsx` is the one shared frame: the `--max-w-app`
centered mobile column (430 cap / 390 baseline), safe-area padding
(`pt-safe`/`pb-safe`), an optional `.cog-glow` layer (`glow` prop), and slots for
`header` / `bottomNav` / `overlay`. It owns the shell *around* a screen, never
the interior. New screens should compose it so the frame + glow stay identical
app-wide; pages that hand-roll their own frame keep working untouched.

## The loading contract — `BrandedSkeleton`

`src/components/shell/BrandedSkeleton.tsx` is the ONE loading state, shared by
both consumers so they never drift:
- App.tsx `<Suspense fallback>` — lazy route chunk in flight.
- `RequireAuth` — auth `status === "loading"` (waits, never flashes anon→authed).

## The motion contract — spatial entrance (NOT AnimatePresence)

Page transitions are owned by the app's **spatial entrance system**, not a
route-level `AnimatePresence` wrapper:

- `src/lib/nav/navDirection.ts` — `useSpatialEntrance(pathname)` returns an
  entrance class (`nav-enter-from-left/right/below`, or a fade) derived from a
  one-shot declared direction (`setNavDirection`) or the from→to surface
  coordinates, so hardware/browser back reverses the motion correctly.
- The classes + `prefers-reduced-motion` fallbacks live in `src/index.css`.
- The BottomNav declares direction on tap; `useSwipeNav` drives edge-swipe.

A screen opts in by applying `useSpatialEntrance(pathname)` to its root element.
Do **not** wrap `<Routes>` in a competing `AnimatePresence` — it would double-
animate and fight the swipe system. The two persistent overlays are outside
`<Routes>` and never animate with the route.

## Nav chrome

- `BottomNav` — global 3-tab (Songs / Capture[raised center] / Settings). Songs
  → `/songs` and stays active across `/songs/:id*`; Capture → `/capture` (also
  active on `/`); Settings → `/settings*`. Badge-free and calm by design.
- `SongTabBar` — song-interior tabs. `BackHeader` — back chrome.
- The workspace hub (`/songs/:id/room`) has no top-bar/sidebar/hamburger — the
  grid is the navigation there; only the global BottomNav shows.
