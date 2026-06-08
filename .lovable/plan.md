## Goal
Make the "Forgot password?" link on `/auth/login` reliably reset your email+password without touching SQL.

## What already exists (no rebuild needed)
- `EmailAuthPage` already has a "Forgot password?" button that calls `requestPasswordReset(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/auth/reset-password })`.
- `ResetPasswordPage` (mounted at `/auth/reset` and `/auth/reset-password`) listens for the `PASSWORD_RECOVERY` event and calls `supabase.auth.updateUser({ password })`.
- `auth.users` has `parker@veepo.ca` confirmed, so reset emails will dispatch.
- Lovable Cloud is sending default auth emails (no custom templates required for this).

So the flow is wired. The remaining work is verification + closing the small gaps that typically break first-time use.

## Plan

### 1. Confirm Cloud auth config allows the reset redirect
- Inspect current auth config via `supabase--project_info`.
- Ensure the Site URL / Additional Redirect URLs include both the preview origin (`https://id-preview--…lovable.app`) and the published origins (`https://new-bloom-spark.lovable.app`, `https://colorsofglory.app`, `https://www.colorsofglory.app`) with the `/auth/reset-password` path allowed. If missing, call `supabase--configure_auth` / update redirect URLs so Supabase doesn't strip the `redirectTo`.
- Keep `password_hibp_enabled: true`, `disable_signup: false`, `auto_confirm_email` unchanged.

### 2. Tiny UX polish on `EmailAuthPage` (frontend only — Lovable owns `src/integrations/cog/*` and auth pages already)
- After a successful `requestPasswordReset`, also surface a one-line hint: "Check your inbox — link expires in 1 hour." (Already shows the generic "If an account exists…" message; just adds the expiry hint.)
- Disable the "Forgot password?" button for 30s after a successful send to prevent rate-limit hits.
- No new files. No changes to `ResetPasswordPage` (already correct).

### 3. End-to-end verification in the live preview
1. Open `/auth/login`, type `parker@veepo.ca`, tap **Forgot password?** → confirm the success message appears and no console/network error.
2. Open the inbox for `parker@veepo.ca`, click the reset link.
3. Land on `/auth/reset-password` — confirm `PASSWORD_RECOVERY` fires (form becomes enabled, not the "invalid/expired" state).
4. Set a new password (≥ 8 chars, non-breached so HIBP passes) → confirm redirect to `/` and the catalog loads.
5. Hard refresh `/` → still signed in.
6. Sign out, sign back in with the new password → confirm success.
7. Negative case: request a reset for an unknown email → confirm the generic "if an account exists…" message still shows (no account enumeration).

### 4. Report back
- Confirmation that all 7 verification steps pass, with the redirect-URL change (if any) noted.
- If the email doesn't arrive within ~2 minutes during step 2, I'll check Cloud → Emails / `email_send_log` and fix the actual delivery path (most likely a missing redirect URL or rate-limit, not a code bug).

## Out of scope
- Custom-branded auth email templates (default Lovable email is fine for now; can scaffold later if you want the cream/gold look).
- Any changes to `RequireAuth`, routing, profiles, RLS, or song tables.
- SMS/phone OTP.

## Technical notes
- No SQL, no direct `auth.users` writes. The reset goes through Supabase's normal recovery flow.
- HIBP is on, so the new password must not appear in a known breach — pick something fresh.
- The reset link is single-use and expires in ~1 hour by default.
