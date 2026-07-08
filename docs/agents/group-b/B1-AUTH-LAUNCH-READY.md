# B1 Auth Surface — Launch-Ready Summary

_Steps 1–10 complete. Polish + gap-closure + hardening + test coverage on the shipped auth baseline._

---

## The flows (all real, no mock, no bypass in prod)

1. **Phone → code → first song** — `/auth/login` (phone, +1 NANP) → `sendPhoneOtp` (Twilio Verify) → `/auth/phone/verify` → `verifyPhoneOtp` → `reconcileInviteToken()` → `routeAfterAuth` into the user's first-song journey.
2. **Email fallback** — `/auth/email` sign-in / create-account (Zod), always reachable beside phone; "Text me a code →" returns to phone.
3. **Forgot / reset** — `/auth/forgot-password` (email→code→new-password) and `/auth/reset-password` (hash-link recovery, invalid-link state).
4. **Founder / referral codes** — `/onboarding/founder-code`: `'founder'` redeems server-side (RPC-gated) → "Founder access unlocked"; `'member_referral'` saves `cog:referral-code` → "Code applied"; invalid → calm inline copy.
5. **Blocked paths** — phone provider disabled / geo-blocked → calm "use email" copy (never a dead end).

## What changed at launch (surgical)

| Step | Change |
|------|--------|
| 2 | PhoneLoginPage: added the quiet trust line; `aria-describedby` now references `phone-error` only when it renders; **removed the red error border** — the field stays neutral, the inline error text carries the state (calm-error contract). |
| 3 | Scoped phone to **US & Canada (NANP)** — one `+1` path is correct E.164 for both; added honest labeling + "elsewhere, use email"; no valid number is silently rejected. |
| 4–5 | Verified CodeVerifyPage + OTPInput: WebOTP / iOS one-time-code / paste / auto-submit / resend / change-number / reduced-motion success all intact. Preserved the single-transparent-input pattern (iOS autofill). |
| 6 | Verified the two founder-code kinds never collapse; founder success only after a real RPC `true`. Added tests. |
| 7 | Unified all auth-screen error text to the calm-error token `var(--cog-record-red)` (`#E05440`). Clamped `friendly()` so a non-`AuthError` can never leak a technical `err.message`. Google OAuth left **unwired** at launch (vision excludes social on the phone screen). |
| 8 | **Invite continuity bridge** — `src/pages/auth/inviteHandoff.ts` reconciles `cog:invite-token` from the `cog:invite-context` blob before every `routeAfterAuth`, so a deep-link invite that authenticates via the main `/auth/*` path is no longer stranded. |
| 9 | Confirmed: dev-only Preview bypass gated by `import.meta.env.DEV`; no other bypass/mock; raw `supabase.auth` only in ResetPasswordPage (justified recovery); capture FAB suppressed on `/auth`, `/onboarding`, `/invite`, `/join`; no technical error string can reach the UI. |
| 10 | Added `cog-code-verify-page.test.tsx` (6) + `cog-founder-code-page.test.tsx` (4). Fixed a `prefer-const` lint in ResetPasswordPage. |

## Verified

- **B1-lane typecheck + lint:** clean.
- **Tests:** `cog-code-verify-page` 6/6, `cog-founder-code-page` 4/4, `cog-phone-otp-input` 5/5 — green in isolation.

## Invariants (all held)

No password on primary path · email always beside phone · calm errors (single token, no red border, no modal, no technical string) · autofill/paste/auto-submit · two founder-code kinds RPC-gated · no prod bypass/mock · hand-off never dead-ends · raw `supabase.auth` only in ResetPassword.

## Known blockers to a fully-green `qa:codex` (OUT OF B1 LANE)

- **Typecheck** fails on pre-existing errors in `src/components/voice/VoiceLayerPanel.tsx` + `src/pages/VoiceMemosPage.tsx` (`VoiceMemoRecord` missing `section_id`/`waveform_peaks`) — C/D/E voice lane.
- **3 test suites** (`seo.test.ts`, etc.) fail because `src/App.tsx` was rewritten in the working tree and no longer contains the route strings they assert — A5 routing lane.

Neither touches the auth surface. B1's contribution is typecheck- and lint-clean and test-covered.

## Follow-ups for other lanes

- **A5/B3:** fold `reconcileInviteToken` into `routeAfterAuth` so `cog:invite-token` becomes the single source of truth and the bridge retires.
- **A3/Lovable:** the Twilio SMS template's last line must be exactly `@colorsofglory.app #<code>` for WebOTP true zero-typing (iOS suggestion autofill works meanwhile).
