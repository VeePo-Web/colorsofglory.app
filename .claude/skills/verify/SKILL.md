---
name: verify
description: Drive the COG app at runtime to verify a change — launch recipe, auth workaround, and gotchas for this repo.
---

# Verifying Colors of Glory at runtime

## Launch
```bash
npm ci                       # worktrees start without node_modules
npx vite --port 5199 --strictPort   # dev server, background it
```
Drive with Playwright (not in devDeps — install in a scratch dir:
`npm i playwright && npx playwright install chromium`). Viewport
390×844 — the app is mobile-first.

## Two gates before any screen renders
1. **Preview gate** (`src/components/PasswordGate.tsx`) — bypass with
   `sessionStorage.setItem("site_unlocked", "true")` in an init script.
2. **Auth** (`RequireAuth` ← `AuthContext` ← `supabase.auth.getSession()`).
   getSession only reads localStorage — a **forged session** gets past the
   client-side gate (RLS still blocks data, so you observe calm
   degraded/error states, which is usually enough):
   - key: `sb-<project-ref>-auth-token` (ref from `VITE_SUPABASE_URL` in `.env`)
   - value: JSON `{access_token: <unsigned JWT, exp in future>, refresh_token,
     token_type:"bearer", expires_at, expires_in, user:{id, aud:"authenticated", ...}}`
   - server-validated calls (`auth.getUser()`, any table/RPC) fail → error paths render.

## Gotchas
- `ctx.addInitScript` re-runs on **every** navigation — after testing
  sign-out, the next `goto` re-seeds the forged session. Test the
  unauthenticated redirect in a context *without* the seed script.
- `BottomNav` is `zIndex: 500` — any overlay/sheet must sit above it
  (Tailwind `z-50` is only 50!).
- 13 vitest failures pre-exist on main (activity/credits routes, canvas,
  phone-otp, seo, codex-mobile) — don't attribute them to your change;
  confirm against a pristine `origin/main` worktree if unsure.
- Real sign-in is not scriptable: email OTP goes through Resend, phone OTP
  through Twilio, so authenticated data flows need a human session.

## Flows worth driving
- `/settings` hub → every row must navigate (no `#` dead links).
- Confirm sheets: disabled-until-typed, Escape closes, focus trapped
  (Tab 10× must stay inside `[role="dialog"]`), renders above BottomNav.
- Guard: hit a `/settings/*` URL with no session → `/auth/login`.
