# Fix Google Sign-In

## Problem
Auth logs show `400: Unsupported provider: missing OAuth secret` when users click "Continue with Google". The Google OAuth provider is not configured on the backend, even though the frontend button calls `signInWithGoogle()`.

## Fix
1. Run `configure_social_auth(providers: ["google"])` to enable Lovable Cloud's managed Google OAuth. This uses Lovable's shared Google credentials — no client ID/secret needed from you, and it works on `colorsofglory.app` and the preview/published URLs automatically.
2. Verify by clicking "Continue with Google" on `/auth/login` in the preview — should redirect to Google's account picker instead of erroring.

## Notes
- The existing SDK call in `src/integrations/cog/auth.ts` (`supabase.auth.signInWithOAuth({ provider: "google", redirectTo: window.location.origin })` ) is compatible with managed Google OAuth — no frontend code changes needed.
- If you later want your own branded Google OAuth (your app name on the consent screen instead of Lovable's), that's a separate follow-up where you create credentials in Google Cloud Console and paste them in Cloud → Auth Settings.
- No DB, RLS, or page changes. This is a one-call backend config change.
