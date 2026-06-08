# Plan: Email + password login (so you can sign in as parker@veepo.ca now)

The current `/auth/login` is a phone-OTP screen, but SMS isn't enabled in Cloud, so every sign-in returns `phone_provider_disabled`. The fix is to route the login screen to an email+password page (with a "Continue with Google" shortcut) and gate the app routes behind a session check. Phone code stays on disk for later.

## 1. Verify Google OAuth is on
Call `configure_social_auth(["google"])` once. If it's already enabled this is a no-op; if not, it provisions the managed Google client so the "Continue with Google" button on the new auth page works without any keys.

## 2. New page — `src/pages/auth/EmailAuthPage.tsx`
A single mobile-first screen, COG visual language (cream `#F5F0E8` bg, gold radial glow, Playfair "Welcome to Colors of Glory" heading, Inter body, gold primary CTA, 430px max width). Uses the existing `OnboardingShell` / `GoldButton` / `CogBrand` components for consistency with the phone page.

State:
- `mode: "signin" | "signup"` toggled by a top tab pair.
- `email`, `password`, `confirmPassword` (signup only), `submitting`, `error`, `infoMsg`.
- Zod validation: `email` valid + ≤255 chars, `password` ≥8 chars + ≤72 chars (Supabase cap). On signup, require `confirmPassword === password`.

Actions:
- **Sign in** → `supabase.auth.signInWithPassword({ email, password })`. On success → `navigate("/", { replace: true })`.
- **Create account** → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })`. On success show "Check your email to confirm" (verification is ON per memory). The `handle_new_user` trigger handles profile + referral_code automatically — no client write needed.
- **Continue with Google** → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })`.
- **Forgot password?** (sign-in tab only) → `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })`. Show inline "Reset link sent" success.

Error handling:
- Map common errors to warm copy: `invalid_credentials` → "That email and password don't match.", `email_not_confirmed` → "Please confirm your email — check your inbox.", `over_email_send_rate_limit` → "Too many attempts. Try again in a minute.", weak-password / pwned → "Pick a stronger password — that one's been seen in a breach." Default → "Something didn't work. Please try again."
- No `console.log` of email or password — only of error codes.

Footer microcopy: "By continuing you agree to our Terms and Privacy." (links can be `#` placeholders for now.)

## 3. New page — `src/pages/auth/ResetPasswordPage.tsx`
Required by the auth instructions so reset links don't silently log people in.

Logic:
- On mount: read `window.location.hash` for `type=recovery`. Supabase auto-creates a recovery session from the link; we listen via `supabase.auth.onAuthStateChange` for the `PASSWORD_RECOVERY` event and unlock the form.
- If not in recovery context, show "This reset link is invalid or expired" + button back to `/auth/login`.
- Form: new password + confirm. On submit → `supabase.auth.updateUser({ password })`. On success → toast "Password updated" → `navigate("/", { replace: true })`.

Same COG styling as `EmailAuthPage`.

## 4. New component — `src/components/auth/RequireAuth.tsx`
Tiny wrapper used only on the routes you care about right now (`/` and `/songs/:id/brainstorm`). Avoids touching the invite/onboarding/canvas flows.

Logic:
- Local state `status: "loading" | "authed" | "anon"`.
- On mount: `supabase.auth.getSession()` to set initial status, then subscribe to `onAuthStateChange` to react to sign-out / sign-in.
- `loading` → render the existing `RouteFallback`-style skeleton.
- `anon` → `<Navigate to="/auth/login" replace state={{ from: location.pathname }} />`.
- `authed` → render children.

(Uses `getSession` for fast client-side gating; the RLS policies on the backend are the real trust boundary, so this is purely UX.)

## 5. Route changes — `src/App.tsx`
```text
- /auth            → Navigate to /auth/login
- /auth/login      → EmailAuthPage           (was PhoneLoginPage)
- /auth/reset      → ResetPasswordPage       (new)
- /                → RequireAuth > SongCatalogPage
- /songs/:id/brainstorm → RequireAuth > BrainstormPage
```
- Drop the `/auth/verify` route (phone OTP step) — orphan the file, don't delete it.
- Leave every other route (`/join/:token`, `/invite/*`, `/onboarding/*`, `/songs/:id`, `/songs/:id/canvas`, settings, admin, pricing) exactly as they are.
- `PhoneLoginPage.tsx` and `CodeVerifyPage.tsx` stay on disk so we can re-enable phone OTP later by flipping two route lines.

## 6. What I'm NOT touching
- Backend: no migrations, no edge-function changes, no RLS edits, no storage rules. The `profiles` table + `handle_new_user` trigger already exist and do the right thing on email signup.
- The invite/join flow, onboarding screens, canvas, brainstorm UI, settings, admin, pricing.
- Phone OTP code on disk — left alone for the day SMS is enabled.
- The Lovable agent-boundary rule says pages live with Claude — this is the same scoped exception we made for the Brainstorm folder so you can use your account right now.

## 7. Verification before I hand off
- Build passes (auto via harness).
- Open `/auth/login` in the preview at 390px width: tabs render, validation triggers on bad input.
- Sign up `parker@veepo.ca` (or sign in if it exists), confirm via email if verification fires, land on `/`, hit **+ New song**, navigate into `/songs/:id/brainstorm`, record a memo end-to-end.
- Sign out path: I'll add a temporary `Sign out` link in the Brainstorm header so you can flip accounts without DevTools. (Tiny — just calls `supabase.auth.signOut()` then redirects.)

## After approval
You go to `/auth/login` → Create account (or Sign in) with `parker@veepo.ca` → land on the catalog → start brainstorming.
