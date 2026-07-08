# B1 Auth Surface — Launch Punch-List

_Step 1 audit of the shipped auth surface. Re-read each file before editing it._

## Screen map

- **PhoneLoginPage** `/auth/login` — OnboardingShell + CogBrand + GoldButton pill "Continue". `sendPhoneOtp` (Turnstile → `phone-otp-start` → Twilio Verify). +1 NANP, forgives pasted +1, writes `cog:phone-*`. Calm inline error. "Use email instead" → `/auth/email`. Dev-only "Preview demo ›".
- **CodeVerifyPage** `/auth/phone/verify` — OTPInput(6) + masked number. `verifyPhoneOtp` (`phone-otp-verify` → session). WebOTP + iOS autofill + paste + auto-submit. 30s resend, change-number, email escape after window. Success gold-flash (reduced-motion aware) → `routeAfterAuth`.
- **EmailAuthPage** `/auth/email` — sign in / create account tabs, Zod, `signInWithPassword` / `signUpWithPassword` (→ email OTP). Forgot link; "Text me a code →" → phone.
- **ForgotPasswordPage** `/auth/forgot-password` — 3-step email→code→password, 60s cooldown, Caps Lock indicator.
- **ResetPasswordPage** `/auth/reset-password` — the one screen reading `supabase.auth` directly (justified recovery detection); invalid-link state.
- **FounderCodePage** `/onboarding/founder-code` — `validateCode` → founder (RPC-gated) / member_referral (saves code) / invalid (calm). Marks `founder_code_seen`.
- **OTPInput** — single transparent `one-time-code` input over visual cells (preserves iOS autofill). **Never split into per-cell inputs.**
- **auth.ts** (Lovable/A3, READ-ONLY) — AuthError + classify(); phone/email OTP + password wrappers; `signInWithGoogle` exported but UNWIRED.

## Open gaps → step

| # | Gap | Step |
|---|-----|------|
| 1 | Privacy/trust line missing (PhoneLogin) | 2 |
| 2 | `aria-describedby` references `phone-error` before it renders | 2 |
| 3 | Error switches phone card border to red — tension with "never a red border" | 2 |
| 4 | Hardcoded +1 / 10 digits — no international support | 3 |
| 5 | No render/behavior tests for `/auth/phone/verify` | 10 |
| 6 | No founder-code two-kinds tests | 10 |
| 7 | Invite continuity split: `cog:invite-token` vs `cog:invite-context` | 8 |
| 8 | Error color token split: `#E05440` (phone) vs `#9B2E2E` (email/reset) | 7 |
| 9 | `friendly()` falls through to raw `err.message` for non-AuthError | 9 |
| 10 | WebOTP zero-typing needs Twilio template line `@colorsofglory.app #<code>` | 4 |
| 11 | `signInWithGoogle` exported but UNWIRED | 7 |

**Not a gap:** every primary CTA is already the `GoldButton` pill; `rounded-2xl` occurrences are all input cards. The codex "rounded-2xl CTA" concern does not reproduce.

## Invariant status (at audit)

no-password ✅ · email-always ✅ · two-founder-kinds ✅ (RPC-gated) · no-prod-bypass ✅ · raw-supabase-only-in-ResetPassword ✅ · calm-errors ⚠️ (gaps 3/8/9). All closed in Steps 2/7/9.
