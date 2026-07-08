# B1 Auth / Phone Login — Progress Log

One entry per completed step.

## Step 1 — Map + punch-list ✅
Read all six screens + OTPInput + auth.ts + GoldButton + routeAfterAuth + inviteContext. Produced `B1-AUTH-PUNCHLIST.md`. Confirmed GoldButton is a pill (CTA gap doesn't reproduce), invite continuity is split, verify-page + founder-code untested. Audit only, no code change.

## Steps 2–10 ✅

- **Step 2 (PhoneLogin):** trust line; conditional `aria-describedby`; removed red error border (calm contract).
- **Step 3 (international):** decision = **US & Canada (NANP)**; one `+1` path is correct E.164 for both; honest labeling; no valid number silently rejected.
- **Steps 4–5 (verify + OTPInput):** verified WebOTP / iOS autofill / paste / auto-submit / resend / change-number / reduced-motion success; single-transparent-input pattern preserved. No refactor.
- **Step 6 (founder code):** two-kinds separation + RPC-gated success verified; new tests.
- **Step 7 (email/reset):** error text unified to `var(--cog-record-red)`; `friendly()` clamped so non-AuthError can't leak a technical string; Google OAuth stays unwired.
- **Step 8 (invite continuity):** `src/pages/auth/inviteHandoff.ts` → `reconcileInviteToken()` copies token from `cog:invite-context` into `cog:invite-token` before every `routeAfterAuth` (CodeVerify, EmailAuth, ForgotPassword). Deep-link invite survives the main auth path.
- **Step 9 (launch safety):** dev-only Preview bypass gated by `import.meta.env.DEV`; no other bypass/mock; raw `supabase.auth` only in ResetPassword; FAB suppressed on `/auth`,`/onboarding`,`/invite`,`/join`; no technical error string reaches the UI.
- **Step 10 (tests):** `cog-code-verify-page.test.tsx` (6/6) + `cog-founder-code-page.test.tsx` (4/4); `cog-phone-otp-input` 5/5. Fixed a `prefer-const` lint in ResetPassword. **B1-lane typecheck + lint clean.** `qa:codex` blocked OUT OF LANE by pre-existing Voice typecheck errors (C/D/E) and App.tsx-driven `seo.test` failures (A5).

**Note:** these auth files are co-edited by another lane (a `useIdlePrefetch` perf pass). My edits were re-applied preserving that prefetch, then committed to git to protect them from working-tree reverts.

**Handoffs:** A5/B3 fold `reconcileInviteToken` into `routeAfterAuth`; A3/Lovable ship the `@colorsofglory.app #<code>` SMS template line.

Auth surface is launch-ready — see `B1-AUTH-LAUNCH-READY.md`.
