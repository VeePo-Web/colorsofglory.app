# Onboarding state machine — backend model

Scope: backend only. Persist server-side onboarding state on `profiles`, enforce legal transitions in an edge function, and let any device resume mid-flow. Claude reads state via `me-summary` and writes via `onboarding-set-step`.

## State machine

Steps (PG enum `onboarding_step`):

```text
not_started
  → intent_selected           (POST intent: writer | worship_leader | team)
  → founder_code_seen         (after redeem-founder-code OR explicit "skip")
  → first_song_created        (set by create-song trigger when profile.first_song_id IS NULL)
  → first_idea_captured       (first text idea / note in that song)
  → first_voice_memo_added    (first voice_memo row in that song)
  → first_lyrics_added        (first lyrics line in that song)
  → first_collaborator_invited (first song_invite for that song)
  → completed                 (terminal; banner & guided overlays off)
  → dismissed                 (terminal; user explicitly skipped the rest)
```

Notes:
- `not_started` is the post-signup default written by `handle_new_user`.
- Linear order BUT later steps may auto-skip earlier ones if their evidence is already present (idempotent). E.g. creating a song while in `intent_selected` jumps state to `first_song_created`.
- `completed` and `dismissed` are terminal — only admin/manual can revert.

## Legal transitions (enforced server-side)

```text
not_started               → intent_selected | dismissed
intent_selected           → founder_code_seen | first_song_created | dismissed
founder_code_seen         → first_song_created | dismissed
first_song_created        → first_idea_captured | first_voice_memo_added | first_lyrics_added | dismissed
first_idea_captured       → first_voice_memo_added | first_lyrics_added | first_collaborator_invited | completed | dismissed
first_voice_memo_added    → first_lyrics_added | first_collaborator_invited | completed | dismissed
first_lyrics_added        → first_collaborator_invited | completed | dismissed
first_collaborator_invited→ completed | dismissed
completed                 → (terminal)
dismissed                 → (terminal; admin can reopen)
```

Forward-only rule: server rejects any move that is not in the row above (returns `INVALID_TRANSITION`). Re-emitting the current step is a no-op `OK`.

## Schema changes (one migration)

`public.profiles` additions:
- `onboarding_step public.onboarding_step NOT NULL DEFAULT 'not_started'`
- `onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb` — small contextual bag: `{ intent, first_song_id, first_memo_id, founder_code_redeemed, dismissed_at, completed_at, history: [{ step, at, source }] }` capped to last 20 history entries.
- `onboarding_updated_at timestamptz NOT NULL DEFAULT now()`

New SECURITY DEFINER helpers:
- `public.onboarding_step_rank(public.onboarding_step) RETURNS int` — ordinal index for "later than current?" checks.
- `public.advance_onboarding(_user_id uuid, _to public.onboarding_step, _patch jsonb, _source text) RETURNS text` — performs:
  1. Lock row `FOR UPDATE`.
  2. If `_to` terminal-equals current → return `OK`.
  3. If current is terminal → return `TERMINAL`.
  4. If `_to` not in legal-next set → `INVALID_TRANSITION`.
  5. Merge `_patch` into `onboarding_state`, push history entry (trimmed to last 20), set `onboarding_step`, `onboarding_updated_at`, write `audit_logs` via `write_audit`.
  6. Return `OK`.
- `public.complete_onboarding(_user_id uuid)` — convenience that jumps to `completed` from any non-terminal step (used by "Skip the rest" CTA).

Auto-evidence triggers (idempotent, never downgrade):
- `AFTER INSERT ON public.songs` — if `owner_user_id`'s `profile.first_song_id IS NULL`, set it and `advance_onboarding` to `first_song_created` (only if current rank < that).
- `AFTER INSERT ON public.voice_memos` — when first memo for that song by owner, advance to `first_voice_memo_added`.
- `AFTER INSERT ON public.song_lyrics` — first line in owner's first song → `first_lyrics_added`.
- `AFTER INSERT ON public.song_invites` — first invite by owner on first song → `first_collaborator_invited`.
- `AFTER INSERT ON public.song_notes` — first note → `first_idea_captured` (only if rank < it).

Each trigger calls `advance_onboarding` with `_source = 'trigger:<event>'`. Triggers swallow `INVALID_TRANSITION`/`TERMINAL` results (silent no-op) so user flow is never blocked by onboarding bookkeeping.

`handle_new_user` update: write `onboarding_step = 'not_started'`, `onboarding_state = jsonb_build_object('history','[]'::jsonb)`. No-op for existing rows on backfill (default already applies).

## Edge function: `onboarding-set-step`

`POST` JSON: `{ to: onboarding_step, patch?: jsonb, source?: 'user'|'system' }`

- Auth required (JWT). Extract user_id from token (use Supabase JWKS validation — `verify_jwt = false` per platform rule but validate in code).
- Zod-validate `to` against enum literal list; `patch` ≤ 2 KB; whitelist allowed keys (`intent`, `founder_code_redeemed`, `dismissed_reason`).
- Call `public.advance_onboarding(user_id, to, patch, 'user:'||source)`.
- Map result → envelope:
  - `OK` → 200 `{ ok:true, step, state }` (re-read profile fields)
  - `INVALID_TRANSITION` → 200 `{ ok:false, code:'INVALID_TRANSITION', current_step }` (so UI can self-correct calmly — not a crash)
  - `TERMINAL` → 200 `{ ok:false, code:'ONBOARDING_TERMINAL', current_step }`
  - Auth missing → 401 `UNAUTHENTICATED`
- Always include CORS headers. Status 200 for all expected-flow errors (matches preview/accept envelope pattern already used in this project).

No separate `dismiss` endpoint — clients call set-step with `to: 'dismissed'` and a `patch.dismissed_reason`.

## me-summary integration

`me-summary` returns:
```ts
onboarding: {
  step: onboarding_step,
  state: { intent?, first_song_id?, founder_code_redeemed?, dismissed_at?, completed_at? },
  next_suggested_route: string,   // server-computed convenience
  updated_at: string
}
```

`next_suggested_route` mapping (server-side single source of truth):
```text
not_started                → /onboarding/intent
intent_selected            → /onboarding/founder-code
founder_code_seen          → /onboarding/start-song
first_song_created         → /songs/{first_song_id}/capture
first_idea_captured        → /songs/{first_song_id}/voice
first_voice_memo_added     → /songs/{first_song_id}/lyrics
first_lyrics_added         → /songs/{first_song_id}/people
first_collaborator_invited → /songs/{first_song_id}
completed | dismissed      → /
```

## Cross-cutting

- `onboarding_state` jsonb has a size guard (CHECK `octet_length(onboarding_state::text) < 4096`).
- GRANTS: no new table — `profiles` already has them; verify `authenticated` has UPDATE only via RLS that scopes to `user_id = auth.uid()` and that the new columns are covered (existing policy uses row-level, not column-level, so OK). The edge function uses service-role internally so RLS is bypassed safely after auth check.
- Realtime: enable on `profiles` for self-row only (already filterable client-side by `user_id`). Optional — clients can also rely on `me-summary` refetch after each call.
- Audit: every advance writes `audit_logs(action='onboarding_advance', entity_type='profile', entity_id=user_id, after=jsonb_build_object('from',old_step,'to',new_step,'source',source))`.
- Backfill migration: for existing rows, infer current step from existing data — if owns ≥1 song → at least `first_song_created`; +memo → `first_voice_memo_added`; +lyrics → `first_lyrics_added`; +invite → `first_collaborator_invited`. Run once in the same migration.

## Out of scope (separate plan items)

- Twilio phone OTP wiring (Plan §1).
- `redeem-founder-code` body (Plan §2) — this plan just records that the redemption happened by advancing to `founder_code_seen`.
- Frontend wiring, banners, guided overlays — Claude owns.

## Suggested execution order

```text
1. Migration: enum, profile cols, helpers, triggers, backfill, handle_new_user patch
2. Edge function onboarding-set-step (+ deploy)
3. Extend me-summary (or add stub if not yet built) to expose onboarding block
4. Smoke test via curl_edge_functions: not_started → intent_selected → founder_code_seen, then attempt illegal jump to verify INVALID_TRANSITION envelope
```
