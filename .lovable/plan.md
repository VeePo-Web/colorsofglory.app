## Root cause

The phone OTP flow works up to the very last step. Logs prove it:

```
phone-otp-start  → 200 {ok:true}            (Twilio SMS sent)
phone-otp-verify → 200 {ok:true, password}  (code matched, user upserted)
/auth/v1/token?grant_type=password (phone+password) → 422 phone_provider_disabled
```

The Auth server refuses `signInWithPassword({ phone, password })` because the native phone provider is OFF on this Cloud project. Our SDK then runs that error through `classify()`, which matches `phone_provider_disabled` and shows the "Text sign-in is just being switched on. Use email below to continue now." message — even though the SMS, code check, and user creation all succeeded.

So the only thing broken is the **session exchange**. Everything before it is healthy.

## The fix: stop using phone+password grant

The phone provider can't be enabled here, so we replace the password-grant exchange with a path that works on this project:

Attach a deterministic synthetic email to every phone user (e.g. `phone+14038308930@auth.colorsofglory.app`) and exchange a one-shot password against **email+password** grant, which is enabled. The user still sees and signs in with their phone — the email is an internal handle only.

## Changes

### `supabase/functions/phone-otp-verify/index.ts`
- After OTP validation succeeds, when creating or updating the auth user via the Admin API, also set `email` to `phone+<digits>@auth.colorsofglory.app` and `email_confirm: true` alongside the existing `phone_confirm: true` and one-shot password.
- For existing users without a synthetic email, patch it on the fly via `updateUserById`.
- Response shape changes from `{ ok, password }` to `{ ok, email, password }`. Keep `password` field for back-compat in case any caller still reads it.

### `src/integrations/cog/auth.ts` → `verifyPhoneOtp`
- Replace `supabase.auth.signInWithPassword({ phone, password })` with `supabase.auth.signInWithPassword({ email, password })` using the email returned by the edge function.
- Keep the same `AuthError` mapping for INVALID_OTP / EXPIRED / MAX_ATTEMPTS.

### `src/integrations/cog/auth.ts` → `classify`
- Narrow the `PHONE_PROVIDER_DISABLED` branch so it only fires when we deliberately call a phone-grant API, not as a catch-all. After the fix it should never trigger from the phone OTP flow at all.

### No DB migration required
- `phone_otps`, `phone_otp_verifications`, and `profiles` already store everything we need. The synthetic email lives only in `auth.users.email` and is never displayed.

## Verification

1. `deploy_edge_functions(["phone-otp-verify"])`.
2. `curl_edge_functions` `phone-otp-start` then `phone-otp-verify` with a real code → expect `{ ok:true, email:"phone+...@auth.colorsofglory.app", password:"..." }`.
3. Reload preview, run phone sign-in end-to-end on `/auth/phone` → expect to land authenticated on `/`, no "switched on" banner, no 422 in network tab.
4. `read_query` on `auth.users` to confirm the row has both `phone` and the synthetic `email`, both confirmed.

## Out of scope (Claude's lane, not this turn)

The verify screen copy ("Text sign-in is just being switched on…") is fine to keep as a fallback for any future genuine provider failure — but after this fix the phone flow will never surface it.