# Lovable backend — what's next

The account/admin feature is **done on Lovable's side**: schema, RLS, `user_roles`, `handle_new_user` trigger, `admin-seed-parker`, `configure_auth` (email confirmation + HIBP), Google OAuth, and the `src/integrations/cog/auth.ts` SDK are all live. Parker is verified as admin. The UI is sitting in Claude's lane via `docs/claude-handoffs/2026-06-08-auth-and-account-menu.md`.

So Lovable should move to the next backend chunk while Claude builds the auth UI. Per `.lovable/plan.md` build sequence, the next phases that are still **partially scaffolded but need hardening / verification / activation** are listed below. I recommend doing them in this order — each is small and unblocks a Claude UI screen.

## Phase A — Phone OTP provider (small, unblocks Phone tab)

Right now `sendPhoneOtp` will return `PROVIDER_NOT_CONFIGURED` because no SMS provider is wired up in Lovable Cloud. Until that's done, the Phone tab Claude builds will only ever show the "coming soon" fallback. Two sub-tasks:

1. Check provider status (`supabase--project_info` / auth settings) and confirm whether Twilio/MessageBird is configured.
2. If not, list exactly which secrets the user must supply (e.g. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGE_SERVICE_SID`) and stop until they provide them — no provisioning until you say go.

## Phase B — Storage buckets + signed-URL verification

Buckets per memory: `voice-memos` (private), `exports` (private), `avatars` (public). Verify each exists with correct policies, and that:

- `voice-memo-upload-url` / `voice-memo-signed-url` edge functions return scoped URLs gated by `is_song_member`.
- `avatars` bucket has public read + per-user write policy so Claude's Settings → Profile avatar upload works when wired.
- Storage triggers correctly bump `profiles.storage_usage` against the **song owner** (not the uploader), per memory.

Output: a short `scripts/codex/verify-storage.md` checklist + linter pass.

## Phase C — Songs/song-content data layer audit

Edge functions (`create-song`, `song-invite-*`, `voice-memo-*`, `song-delete`, etc.) exist. Before Claude builds the Song Workspace UI, run a verification pass:

1. `supabase--linter` for RLS warnings on `songs`, `song_sections`, `lyrics`, `voice_memos`, `song_notes`, `chord_charts`, `collaborators`, `versions`, `activity_log`, `credits`.
2. Confirm every policy uses `is_song_member` / `song_role` SECURITY DEFINER helpers (not inline subqueries).
3. Confirm `create-song` enforces "free plan = 1 owned active song" server-side, and invited memberships don't consume the invitee's slot.
4. Spot-check with `supabase--read_query` that activity payloads store IDs + event kinds only (no raw lyric/memo content).

Output: a Claude handoff doc for the **Song Catalog + Song Workspace hub** (the next big UI chunk per CLAUDE.md Phase 2 build order).

## Phase D — Stripe payments go-live readiness (defer unless asked)

`payments-v2.md` already exists; `enable_stripe_payments`, `create-checkout`, `billing-customer-portal`, `payments-webhook` are wired. Before launch: run `payments--get_go_live_status`, confirm products/prices exist in live mode, verify webhook secret. **Skip this round** unless user asks — paywall UI isn't being built yet.

## Recommendation

Do **A → B → C** in that order. A is ~5 min (probably blocked on user secrets). B is one verification pass + maybe a policy fix. C produces the next Claude handoff doc so Claude has continuous work after the auth UI lands.

## Question for you

Which phase do you want to start with?

- **A — Phone OTP provider** (fastest; likely needs you to give Twilio creds)
- **B — Storage buckets verification**
- **C — Songs data-layer audit + write the Song Workspace Claude handoff**
- **All three in order** (I'll pause at A if secrets are missing)

Nothing in this plan touches `src/pages/**` or `src/components/**` — strictly Lovable's lane (migrations, edge functions, storage, secrets, plus `docs/claude-handoffs/*` and `scripts/codex/*`).
