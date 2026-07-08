# COG Client State Model

**Owner:** A4 · Client State Agent. **Scope:** how the app *holds* and *orchestrates*
state on the client. Not how it fetches (A3) or renders (feature agents).

There is **no Zustand/Redux/Recoil** and there will not be (Group A decision D3).
State lives in three places, chosen by the decision tree below.

## The decision tree — "where does this state go?"

```
Is it backed by the server (songs, memos, members, activity, profile)?
  └─ YES → TanStack Query. Key from the qk factory (src/lib/cache/queryKeys.ts).
           Never hand-cache server data in Context or useState.
Is it durable capture that must survive reload/offline (recorded takes)?
  └─ YES → the Capture Outbox (src/lib/voice/captureOutbox.ts), read via
           usePendingCaptures (src/lib/outbox/OutboxContext.tsx).
Is it cross-cutting ephemeral UI shared across routes (auth identity,
practice playback, invite carrier)?
  └─ YES → a React Context in src/lib/** or src/components/**.
Otherwise → local useState in the component that owns it.
```

Persisted browser keys are **never** read as raw strings in feature code — they go
through a typed helper (below).

## Classification of every current store / key

| State | Home | Notes |
|---|---|---|
| Auth identity (`status`, `user`, `session`) | `src/lib/auth/AuthContext.tsx` | **One** `onAuthStateChange` app-wide. `useAuth()`. |
| Account profile + admin flag | `src/hooks/useCurrentAccount.ts` | Enriches `useAuth()` — no own subscription. |
| Song/catalog/memo/member/activity data | TanStack Query | A3's hooks; keys via `qk`. |
| Active-song pointer (`cog:active-song`, legacy `cog:first-song`) | `src/lib/songContext.ts` | Session continuity cache for instant paint — **not** a data source. One writer via `setSong`. |
| Song title | `useSongTitle` | Read-through: real detail (A3 `getSong`) → cached pointer fallback. No mock. |
| Practice playback | `src/hooks/usePracticePlayer.ts` + `PracticePlayerContext` | Ephemeral + persisted resume. RAF torn down on unmount. |
| Invite carrier (`cog:invite-context`) | `src/lib/invite/inviteContext.ts` | Session carrier across invite screens; populated by real `previewInvite()`. |
| Capture outbox (`cog-capture-outbox` + `audioCache`) | `src/lib/voice/captureOutbox.ts` | Durable; React face = `usePendingCaptures`. |
| Preview unlock (`site_unlocked`) | `src/lib/preview/previewUnlock.ts` | Above the auth machine. `isPreviewUnlocked()` / `setPreviewUnlocked()`. |
| Onboarding step (`profiles.onboarding_step`) | `src/lib/onboarding/onboardingStep.ts` | Typed `useOnboardingStep()`; all 11 enum values. |
| Routing intents (`cog:pending-checkout`, `cog:invite-token`) | `src/lib/onboarding/onboardingStep.ts` | Typed `pendingCheckout` / `pendingInviteToken`. |

## Cache invalidation

One table maps a mutation → the keys it invalidates: `src/lib/cache/invalidation.ts`.
Feature code never calls `queryClient.invalidateQueries()` ad hoc — it calls the
matching entry. Optimistic writes use `src/lib/cache/optimistic.ts`
(snapshot → apply → rollback-on-error → settle).

## Launch invariants

- **Zero mock data.** No mock song catalog; no `"Grace in the Waiting"` render literals.
- **Zero bypass flags.** No `BYPASS_AUTH`.
- **One auth subscription.** Only `AuthContext` subscribes globally.
- **One active-song pointer.** `cog:active-song` + `cog:first-song` written together.

## Seams to other agents

- **A2** — when the `@/types` barrel lands, re-point `OnboardingStep` at
  `Enums<'onboarding_step'>` and import shared types from there.
- **A3** — replace `src/lib/cache/queryKeys.ts` with A3's canonical `qk` factory
  (shapes are the contract); A3's mutation hooks call `invalidationMap` + the
  optimistic helper; `useSongTitle` consumes A3's real `getSong`.
- **A5** — mounts the provider tree in `App.tsx`; routes `useOnboardingStep()` →
  screen. `RequireAuth` consumes `useAuth`.
