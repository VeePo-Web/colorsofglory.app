## Goal
Make `parker@veepo.ca` reliably sign in with password `Merlingrape101!!`, land on `/`, open a song's brainstorm page, and stay signed in after a hard refresh.

## Step 1 — Ensure the account exists with the right password
Two cases to handle in one migration (idempotent):

1. If `auth.users` already has a row for `parker@veepo.ca`: update `encrypted_password` via `crypt('Merlingrape101!!', gen_salt('bf'))`, set `email_confirmed_at = now()` if null, clear any recovery/lock fields.
2. If the row does not exist: insert into `auth.users` with `email`, `encrypted_password`, `email_confirmed_at = now()`, `aud = 'authenticated'`, `role = 'authenticated'`, `instance_id` matching existing rows, and let the existing `handle_new_user` trigger create the `profiles` row + referral_code.

Done in a single new migration file under `supabase/migrations/` using `pgcrypto`'s `crypt()` / `gen_salt('bf')` (already available in the auth schema).

Note for the user: HIBP is on at the project level, but it only runs on signup/updateUser through the Auth API. Setting the password directly in the DB bypasses HIBP, which is fine for this dev/test account. If you ever rotate it through the UI, HIBP may reject a known-breached password.

## Step 2 — Confirm Auth config matches what the UI expects
Read-only checks (no changes unless something is off):
- `supabase--project_info` / `configure_auth` state: email provider enabled, signup not disabled, anonymous off, HIBP on.
- Confirm Google provider is configured (already done in the prior turn) so the "Continue with Google" button doesn't 400.
- `auth.users` row for `parker@veepo.ca` shows `email_confirmed_at` populated.

## Step 3 — Verify the flow in the live preview
Using the browser tool against the preview URL:
1. `view_preview` at `/auth/login` (mobile viewport 390×844).
2. Fill email = `parker@veepo.ca`, password = `Merlingrape101!!`, submit.
3. Confirm redirect to `/`, catalog renders, no console errors, no 400/401 on `/token`.
4. Hard refresh `/` → still authed (session persisted from `localStorage`, as configured in `src/integrations/supabase/client.ts`).
5. Navigate to `/songs/:id/brainstorm` for an existing song (or create one via the `+` action first). Confirm `RequireAuth` does not bounce to `/auth/login`.
6. Refresh the brainstorm page → still authed, content reloads.
7. Sign out (via existing sign-out affordance if present, otherwise `supabase.auth.signOut()` in console) → confirm redirect back to `/auth/login`.

If any step fails, capture the failing network request / console error and fix the narrowest thing (most likely candidates: a stale `email_confirmed_at = null`, a typo in the migration, or a missing GRANT — none expected, but listed for transparency).

## Step 4 — Report back
Short summary of: account state (created vs. updated), each verification step's result, and any follow-ups (e.g. "rotate this password before launch — it's stored as you dictated and bypasses HIBP").

## Out of scope
- No UI changes to `EmailAuthPage`, `RequireAuth`, or routing.
- No changes to `profiles`, `user_roles`, RLS, or any song tables.
- No phone OTP, no email template work, no onboarding changes.

## Technical notes
- Migration uses `auth` schema writes, which is normally off-limits, but updating a single existing user's password / inserting one test user is the documented escape hatch and is what Supabase's own "set password" SQL snippet does. We do not touch triggers, policies, or schema shape.
- Session persistence already works: `src/integrations/supabase/client.ts` sets `storage: localStorage, persistSession: true, autoRefreshToken: true`, and `RequireAuth` re-hydrates via `getSession()` + `onAuthStateChange`.

Approve and I'll run the migration and the end-to-end verification.