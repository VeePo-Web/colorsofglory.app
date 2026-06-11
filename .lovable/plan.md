
# Remove "Lovable" branding from Google sign-in

## Why
The managed Google OAuth flow currently routes users through `oauth.lovable.app` and shows "Lovable" on the Google consent screen. You want zero mention of Lovable. The fix is to use your **own** Google OAuth Client ID + Secret, registered under your Google Cloud project (Colors of Glory / colorsofglory.app), and let the backend Auth server (not the managed broker) handle the redirect.

## What changes

### 1. Code change — go back to the native Supabase OAuth call
Edit `src/integrations/cog/auth.ts`:
- Remove the `import { lovable } from "@/integrations/lovable/index"` line.
- Replace `signInWithGoogle()` body with the native call:
  ```ts
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw classify(error);
  ```
This makes the OAuth callback hit your backend Auth domain directly — no `oauth.lovable.app` in the URL chain. The user will only see Google → your app's branding.

No other code files need changes. `EmailAuthPage.tsx` already calls `signInWithGoogle()` and stays as-is.

### 2. You provide your own Google OAuth credentials
The backend's Google provider currently uses managed credentials (which is what triggers the broker). To use your own:

**Steps you do in Google Cloud Console (https://console.cloud.google.com):**
1. Create or select a project named "Colors of Glory".
2. **OAuth consent screen** → External → fill in:
   - App name: `Colors of Glory`
   - User support email: your email
   - App logo: your COG logo
   - Authorized domains: `colorsofglory.app`, `lovable.app` (required because the backend Auth callback lives on a `*.supabase.co` / managed domain — but the **user-visible** name is "Colors of Glory")
   - Scopes: `openid`, `email`, `profile`
3. **Credentials** → Create Credentials → OAuth Client ID → Web application:
   - Name: `Colors of Glory Web`
   - Authorized redirect URI: I will fetch the exact callback URL from the backend and give it to you to paste here (it looks like `https://<project>.supabase.co/auth/v1/callback`).
4. Copy the generated **Client ID** and **Client Secret**.

**Then you give me those two values** and I store them on the backend Google provider (this replaces the managed credentials, so the flow no longer touches any broker domain).

### 3. Verify
- Click "Continue with Google" → redirect goes straight to `accounts.google.com`.
- Consent screen shows "Colors of Glory wants to access your Google Account" — no "Lovable" anywhere.
- After approval, redirect returns to `colorsofglory.app` and the session is established.

## What I need from you to proceed
1. Confirm you want to register your own Google OAuth app (takes ~5 min in Google Cloud Console).
2. Once you have the Client ID + Secret, paste them and I'll wire them in and verify.

If you'd rather I generate the exact step-by-step with the redirect URI filled in first, say "give me the redirect URI" and I'll fetch it before you start in Google Cloud.
