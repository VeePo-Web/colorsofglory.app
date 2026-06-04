Ship the in-depth onboarding scale + correctness pass exactly as presented:

1. **Migration:**
   - Recreate `on_auth_user_confirmed` trigger with `WHEN` clause (only fire on confirmation transitions).
   - Add indexes: `profiles(onboarding_step)`, `profiles(onboarding_updated_at DESC)`, `founder_redemptions(code)`, partial `founder_codes(expires_at) WHERE active`.
   - Fix history-reversal bug in `advance_onboarding` trim (keep last 20 in oldest→newest order).
   - Rewrite `advance_onboarding_for_song_owner`: lock-free fast path (plain SELECT first, FOR UPDATE only if a transition is needed), trim history to 20, write audit log.
   - Wrap `handle_new_user` referral lookup + `user_roles` insert in `BEGIN…EXCEPTION WHEN OTHERS THEN NULL`.
   - Add `founder_codes` CHECK constraint: `code = upper(code) AND code ~ '^[A-Z0-9-]{4,32}$'`.
   - Create `public.onboarding_funnel_v1` view, grant SELECT to service_role only.

2. **Edge function edits:**
   - `onboarding-set-step/index.ts`: stop prefixing source (`_source: source`); fix `NEXT_ROUTE.first_song_created` to `/songs/${id}`.
   - `redeem-founder-code/index.ts`: fix `nextRouteFor` for `first_song_created` (no `/onboarding/capture`); add structured log line on every outcome.

3. **Doc append** to `.lovable/plan.md`: monotonic-onboarding decision, shard-popular-codes guidance, no-rate-limiter rationale.

No frontend changes, no `src/pages/**` or `src/components/**` edits.