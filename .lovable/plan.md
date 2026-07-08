# Fix: Email signup silently drops the OTP step

## Problem

When you tap "Create account" on `/auth/email`, `signUpWithPassword` (in `src/integrations/cog/auth.ts`) already calls `startEmailOtp({ purpose: "signup" })` — a 6-digit branded code is sent via Resend from `email-otp-start`. But the UI just flips back to the "Sign in" tab and shows a small "check your inbox" hint. There is **no screen to enter the code**, so the user has to leave, come back, and type their password blind. The phone flow, by contrast, has a dedicated `CodeVerifyPage` with 6 lit-up cells, auto-submit, resend timer, and a gold success flash.

The backend is already there:
- `startEmailOtp({ email, purpose: "signup" | "login" | "reset" })`
- `verifyEmailOtp(...)` / `completeEmailSignup({ email, password, code, firstName?, lastName? })` — verifies the code, sets the password server-side, then signs in.

We just need the missing screen.

## Plan

### 1. New page `src/pages/auth/EmailCodeVerifyPage.tsx` at route `/auth/email/verify`

Mirror `CodeVerifyPage.tsx` exactly in look and behaviour, adapted for email:

- Reads `cog:email-address` + `cog:email-purpose` (`"signup" | "login"`) + optionally `cog:email-password` (only for signup, held in `sessionStorage` for the length of the flow, cleared on success/back) from sessionStorage. If missing, redirect back to `/auth/email`.
- Uses the existing `OTPInput` (6 cells, `one-time-code` autofill, paste, auto-submit) — same cells "light up" as digits fill.
- Masked recipient line: `we sent a code to j•••@gmail.com`.
- 30s resend countdown → calls `startEmailOtp` again; "Change email" link → back to `/auth/email`.
- On 6 digits: for `signup` calls `completeEmailSignup(...)`; for `login` calls `verifyEmailOtp({ purpose: "login" })` then `signInWithPassword` (login path is a small follow-up, main fix is signup).
- On success: same gold flash animation as `CodeVerifyPage` (reduced-motion aware) → `reconcileInviteToken()` → `routeAfterAuth(navigate)`.
- Friendly error mapping via the existing `AuthError` classifier (invalid_code / expired / too_many_attempts / weak_password).
- Clears `cog:email-password` from sessionStorage in a `finally` after success or on unmount.

### 2. Wire the route

`src/routes/authRoutes.tsx` — add `<Route path="/auth/email/verify" element={<EmailCodeVerifyPage />} />` next to the phone verify route, lazy-loaded.

### 3. Update `EmailAuthPage.tsx` create-account submit

Replace the current "flip back to Sign in and show info line" branch with:

```
// signup
sessionStorage.setItem("cog:email-address", email);
sessionStorage.setItem("cog:email-purpose", "signup");
sessionStorage.setItem("cog:email-password", password); // consumed by verify page, cleared after
navigate("/auth/email/verify");
```

Sign-in tab is unchanged (still `signInWithPassword` → route).

### 4. Nothing else changes

- Backend, edge functions, RLS, Stripe, phone flow, forgot-password flow — all untouched.
- No new dependencies.
- `signUpWithPassword` in `auth.ts` stays as the single source of truth for "start signup"; the page just routes to the verify screen instead of showing a hint.

## Technical notes

- Password briefly sits in `sessionStorage` under `cog:email-password` so the verify page can call `completeEmailSignup`. Alternative would be passing it via `navigate(..., { state })`, which survives back-nav less predictably on iOS Safari. sessionStorage is scoped to the tab, cleared on tab close, and we wipe it in a `finally` block once the code call resolves (success or terminal error). Matches how the phone flow stashes `cog:phone-e164` / `cog:phone-display`.
- Reuse `OTPInput`, `GoldButton`, `OnboardingShell`, `CogBrand`, `useIdlePrefetch`, `reconcileInviteToken`, `routeAfterAuth` — no new primitives.
- Success animation: copy the exact gold-flash block from `CodeVerifyPage` so both flows feel identical.

## Files touched

- **new**: `src/pages/auth/EmailCodeVerifyPage.tsx`
- **edit**: `src/routes/authRoutes.tsx` (one lazy import + one `<Route>`)
- **edit**: `src/pages/auth/EmailAuthPage.tsx` (replace signup branch, drop the `info` banner + "flip to signin" behaviour)
