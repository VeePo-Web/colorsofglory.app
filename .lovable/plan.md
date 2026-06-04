## Plan: Onboarding backend gap-fixes (A + B + C)

Ship one migration that closes the three top audit gaps. Backend only — no frontend or edge-function changes.

### A. Auto-advance onboarding on email or phone confirmation

- New SECURITY DEFINER helper `public.on_auth_user_confirmed(_user_id uuid)`:
  - Re-syncs `profiles.phone_e164` from `auth.users.phone` (E.164-normalized) so phone-only late confirmations still populate the column.
  - Calls `advance_onboarding(_user_id, 'intent_selected', '{"confirmed_via":"auth"}', 'trigger:auth_confirmed')` **only when** current step is `not_started`. Swallows `INVALID_TRANSITION` / `TERMINAL` so re-confirmation or already-advanced users are no-ops.
- New trigger `on_auth_user_confirmed` on `auth.users` `AFTER UPDATE`, fired when either `email_confirmed_at` or `phone_confirmed_at` transitions `NULL → NOT NULL`. Calls the helper with `NEW.id`.
- One-shot backfill in the same migration: for every `profiles` row where `onboarding_step = 'not_started'` AND the matching `auth.users` row has `email_confirmed_at IS NOT NULL OR phone_confirmed_at IS NOT NULL`, advance to `intent_selected` with source `trigger:auth_confirmed_backfill`.

### B. Seed founder codes

Insert three live codes into `public.founder_codes` so `redeem-founder-code` returns real results:

| code | label | max_uses | expires_at | perks |
|---|---|---|---|---|
| `FOUNDER-LAUNCH` | Launch founders | 100 | NULL | `{"plan_tier":"founder","storage_bonus_mb":500}` |
| `WORSHIP-2026` | 2026 worship leaders | 250 | `2026-12-31` | `{"plan_tier":"founder","storage_bonus_mb":250}` |
| `SEED-FOUNDER-1` | QA / smoke test | 5 | NULL | `{}` |

(Perks are stored only — actual entitlement application is Phase D, per existing plan.)

### C. Collapse duplicate phone columns on `profiles`

- Backfill: `UPDATE profiles SET phone_e164 = '+' || regexp_replace(phone, '^\+', '') WHERE phone_e164 IS NULL AND phone IS NOT NULL AND phone <> ''`.
- Drop legacy `profiles.phone` column.
- Update `public.handle_new_user()` to write `NEW.phone` directly into `phone_e164` (E.164-normalized — Supabase already stores phone in `+E.164` once confirmed, but normalize defensively).
- `sync_profile_phone` trigger already targets `phone_e164` only — no change needed there.

### Not included (deferred, called out in audit)

- D rate-limit, E route-map sanity, F Deno tests, G dismissal audit logging — separate follow-up if you want them.

### Risk / rollback

- Trigger is idempotent and swallows transition errors; safe to re-run.
- Dropping `profiles.phone` is irreversible in this migration but no edge function or RLS policy currently reads it (audited via grep over `supabase/functions` + `src/integrations/cog`).
- Backfill statements are bounded by `WHERE` clauses and safe on an empty dataset.

### Verification after migration

- `SELECT code, max_uses, uses FROM founder_codes;` → 3 rows.
- `\d profiles` → no `phone` column, `phone_e164` still unique.
- New trigger visible: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;`.
- Smoke from frontend: sign up via email, confirm → `profiles.onboarding_step` lands on `intent_selected` automatically.
