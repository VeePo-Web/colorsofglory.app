# A4 · Client State — Progress

Runs after A2, overlaps A3, before A5. A2/A3 had not landed at execution time, so
this built against the real sources that exist (`@/integrations/supabase/types`
for enums; `cog/songs.getSong` for real titles) with documented seams for A2's
`@/types` barrel and A3's `qk` factory.

## Delivered (all on origin/main)

- **QueryClient extracted** — `src/lib/queryClient.ts` (exported; calmer defaults:
  `refetchOnWindowFocus: false`, `gcTime 30min`, staleTime 5min, retry 1).
- **AuthProvider** — `src/lib/auth/AuthContext.tsx`: one `onAuthStateChange`
  app-wide, `useAuth() → {status,user,session}`. `BYPASS_AUTH` deleted;
  `RequireAuth` consumes `useAuth`; `useCurrentAccount` enriches on top (no own
  subscription).
- **Mock songContext killed** — `src/lib/songContext.ts`: `MOCK_SONGS` gone;
  `useSongTitle` is a real read-through (backend title → cached pointer → "" skeleton).
  `cog:active-song` + legacy `cog:first-song` written together (one bridge).
- **Invalidation policy** — `src/lib/cache/invalidation.ts` + forward-compatible
  `src/lib/cache/queryKeys.ts` (`qk`). Mutation→keys map; `moveNode` targeted.
- **Optimistic helper** — `src/lib/cache/optimistic.ts` (begin/rollback/settle).
- **Outbox context** — `src/lib/outbox/OutboxContext.tsx` (`usePendingCaptures`
  over one subscription); durable core untouched.
- **Typed selectors** — `src/lib/preview/previewUnlock.ts`
  (`isPreviewUnlocked`/`setPreviewUnlocked`) and `src/lib/onboarding/onboardingStep.ts`
  (`useOnboardingStep` + all 11 `ONBOARDING_STEPS` + typed `pendingCheckout` /
  `pendingInviteToken`) — `referral_program_seen` / `founder_code_seen` no longer
  swallowed.
- **Practice + invite contexts** — audited leak-free (RAF/timers/AudioContext torn
  down on unmount; `stateRef` guards closures). No defects.
- **Tests** — `src/test/client-state.test.tsx`: auth single-subscription +
  anon→authed→signout, invalidation map, optimistic rollback, preview round-trip,
  onboarding enum.
- **Docs** — `docs/STATE-MODEL.md` (the "where does state go" reference).

## Verified

- `tsc --noEmit` clean.
- grep: no `MOCK_SONGS`, no `BYPASS_AUTH`, no mock title literals in app source.
- One global auth subscription.

## Concurrency note

Executed alongside B1/B2/B3/C2/E-group agents on a shared tree with live
`git reset --hard` / branch switches. Some A4 files were destroyed mid-run and
re-created; the final state above is what landed on `origin/main`.

## Seams (when A2/A3 land)

- A2: re-point `OnboardingStep` at `Enums<'onboarding_step'>` from `@/types`.
- A3: replace `queryKeys.ts` with A3's `qk`; wire `invalidationMap` + optimistic
  helper into A3's mutation hooks; `useSongTitle` → A3's real detail hook.
