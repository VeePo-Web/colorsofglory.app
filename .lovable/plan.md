Remove Google OAuth from auth flow and disable it on the backend. Ship email + password only.

## Scope
1. **Frontend — `src/pages/auth/EmailAuthPage.tsx`**
   - Remove the Google button, the "or" divider, and the `GoogleIcon` component.
   - Remove unused `signInWithGoogle` import from `src/integrations/cog/auth`.
   - Remove the `handleGoogle` function and its error handling.
   - Keep everything else exactly as-is (tabs, email/password fields, forgot password, terms copy).

2. **Backend — Disable Google provider**
   - Call `supabase--configure_social_auth` with `providers: []`, `disable_providers: ["google"]`.
   - Keep email auth enabled (do NOT disable it).

3. **No changes to**
   - `ResetPasswordPage.tsx`
   - Phone OTP pages (already route-commented as disabled)
   - `src/integrations/cog/auth.ts` SDK (except import cleanup in consumer)
   - Any onboarding flow logic

## Rationale
- The user does not have Google OAuth credentials yet and wants to ship now.
- Email/password is fully wired (sign-in, sign-up, forgot password, reset password).
- Google can be re-enabled later by reversing this plan.

## Verify
- Preview `/auth/login` — confirm no Google button, no "or" divider.
- Confirm sign-in and sign-up tabs still work.
- Confirm forgot password flow still works.