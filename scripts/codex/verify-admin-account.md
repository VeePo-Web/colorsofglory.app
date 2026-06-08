# Codex verification — owner/admin account

Run after Claude ships the auth UI.

1. Open `/auth/sign-in` (Email tab). Sign in:
   - email: `parker@veepo.ca`
   - password: `Merlingrape101!!Merlingrape101!!Merlingrape101!!Merlingrape101!!`
   Expect redirect to `/`.
2. AccountMenu (top-right) shows `parker@veepo.ca` and an "Admin" item.
3. Click "Admin" → `/admin` loads through `RequireAdmin` (no redirect to `/`).
4. Open devtools console:
   ```js
   const { isCurrentUserAdmin } = await import('/src/integrations/cog/auth.ts');
   await isCurrentUserAdmin(); // → true
   ```
5. `/settings` renders all four cards without console errors.
6. Click "Sign out" → redirected to `/auth/sign-in`. Refresh `/admin` → bounced back to sign-in with `?next=/admin`.
7. `/auth/forgot-password` → submit email → success state shown (no enumeration).
8. `/auth/reset-password` (visit directly) → form renders without crashing on missing hash.

Fail any step → file an issue with screenshot + network HAR.