## Plan: Fix Google sign-in

The error is happening because the app is still calling the raw auth provider URL directly from `src/integrations/cog/auth.ts`:

```ts
supabase.auth.signInWithOAuth({ provider: "google" })
```

For Lovable Cloud managed Google OAuth, it must use the generated Lovable auth bridge instead:

```ts
lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin,
})
```

## Changes

1. Update `src/integrations/cog/auth.ts`
   - Import `lovable` from `@/integrations/lovable/index`.
   - Replace the raw Google OAuth call with `lovable.auth.signInWithOAuth("google", ...)`.
   - Preserve the existing `signInWithGoogle()` wrapper so the frontend does not need to change.
   - Keep redirect behavior equivalent: default back to the site origin, with optional override support.

2. Leave frontend pages/components untouched
   - `EmailAuthPage.tsx` already calls `signInWithGoogle()` correctly.
   - No UI or route changes are needed.

3. Validate
   - Confirm the login button now initiates the Lovable managed OAuth flow instead of hitting `/authorize` with the missing-secret error.