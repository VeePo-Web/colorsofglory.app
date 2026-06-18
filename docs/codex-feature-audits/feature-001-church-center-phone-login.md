# Feature 001 Audit: Church Center-Style Phone Number Login UX

Date: 2026-06-16
Spreadsheet label: `0.1`  
Verdict: **Fail for live Twilio release; client UX passes, but app-level clean re-audit is currently blocked by provider config and a red QA gate**

Re-audit / Twilio stress update, 2026-06-16 local:

- Fresh focused Feature 001 stress coverage still passes: 8/8 mocked tests for direct phone OTP send setup, provider-disabled/rate-limit/invalid/network send failures, OTP paste rejection cleanup, and invite OTP rejection with Supabase-style plain error objects.
- Fresh browser audit at 390 x 844 still passes: `/auth/phone` had `Welcome`, one phone input, disabled 56px Continue CTA, valid input formatted to `(555) 555-1212` and enabled Continue, no horizontal overflow, no console errors, and no global capture action. Continue was not clicked, so no live OTP was sent.
- `/auth/verify` redirected through `/auth/phone/verify` and then to `/auth/login` without phone session. `/invite/verify` redirected to `/invite/demo` without phone session. Both were free of global capture and overflow at 390 x 844.
- No real SMS was sent. A no-cost invalid-number OTP endpoint dry run returned HTTP 400 `phone_provider_disabled` on 5 of 5 attempts, first message `Unsupported phone provider`, latency 121-935ms, `liveSmsSent: false`.
- The repository Deno stress runner still could not execute because `deno` is not installed locally and no private `scripts/stress/phones.json` is present; a small Node dry-run was used for the live endpoint validation path.
- `npm.cmd run qa:codex` is currently red. Lint, typecheck, build, auth-specific stress tests, old-brand scans, accessibility/instant-feel source checks, placeholder scan, and 28 preview route smokes passed, but the full test run had one transient-looking Feature 04 canvas timeout and the bundle budget failed on `BrainstormPage-GZHUXPv2.js` at 32.4 kB against a 15.6 kB route budget.
- Isolated rerun of `npm.cmd run test -- src/test/feature04-canvas.test.tsx` passed 3/3, so the canvas timeout appears to be suite timing pressure rather than a deterministic auth regression.
- Release status: the phone-login client UX is ready for a clean UX re-audit, but live Church Center-style phone login remains blocked until Supabase Phone Auth/Twilio is enabled and the current app-level QA gate is green again.

Previous 2026-06-15 update:

- The original client-side hard blockers are cleared: global capture is suppressed across auth/onboarding/invite routes, the lint/typecheck/capture/practice blockers are gone, and `/auth/verify` is covered through the seeded mobile render path.
- The active routed phone flow remains `/auth/phone` -> `/auth/phone/verify`; `/auth/verify` is a legacy redirect to the phone verification route, then falls back to `/auth/login` when no phone session is present.
- New mocked Feature 001 stress coverage passes: direct phone OTP send setup, provider-disabled/rate-limit/invalid/network send failures, OTP paste rejection cleanup, and invite OTP rejection with Supabase-style plain error objects.
- Browser audit at 390 x 844 passed after unlocking the private preview gate: `/auth/phone` had `Welcome`, one phone input, disabled 56px Continue CTA, no horizontal overflow, no console errors, and no global capture action.
- No real SMS was sent. A no-cost invalid-number OTP endpoint dry run returned HTTP 400 `phone_provider_disabled` on 3 of 3 attempts, which means the connected Supabase/Twilio phone provider is not enabled for live SMS login in this environment.
- The repository Deno stress runner could not execute because `deno` is not installed locally; a tiny Node dry-run was used for the live endpoint validation path instead.
- `npm.cmd run qa:codex` passes hard checks: lint, typecheck, production build, 92 Vitest tests, bundle budget, old-brand scans, accessibility/instant-feel source checks, placeholder scan, and 28 preview route smokes.
- Release status: the app client is ready for a clean UX re-audit, but live Church Center-style phone login is blocked until Supabase Phone Auth/Twilio is enabled and a real canary number passes send/verify.

## Feature Identity

Feature name: Church Center-Style Phone Number Login UX  
Category: Settings  
Priority: Critical  
Phase: Phase 1  
Primary route map: `/auth/phone`, `/auth/phone/verify`, `/auth/verify`, `/join/:token`, `/invite/verify`

Product intent:

This feature exists so worship leaders, songwriters, and invited collaborators can enter a private song room with phone-code familiarity, no password burden, and no account-setup anxiety.

Core songwriter question:

If I am writing a worship song and inspiration is fragile, does this feature help me move faster, calmer, and with more confidence?

Current answer after the 2026-06-16 stress pass: **client UX is ready for clean UX re-audit, but live SMS login is not release-ready and the app-level QA gate is red.** The original global capture blocker is cleared. The current P0 for phone login is external configuration: the connected Supabase/Twilio phone provider returns `phone_provider_disabled`. The current non-auth release blockers are the red bundle budget and full-suite timing failure captured in the QA gate.

## Spreadsheet Source Row Fields

Description:

The flow should feel like Church Center in spirit: phone number, SMS code, inside the app. No confusing account creation, no visible password setup, no overloaded form, no technical friction. Guest collaborators should be able to enter a number, verify identity, and land directly in the song/workspace they were invited into.

Implementation plan:

- Design settings/config UI following Apple HIG
- Implement preference storage and sync
- Build validation and error handling
- Add progressive disclosure of advanced options
- Test persistence across sessions and devices

Testing requirements:

- SMS delivery across carriers
- Code expiry
- Guest invite flow end to end
- Wrong code, expired code, rate limiting
- Accessibility of code input fields

Accessibility notes:

- Screen reader announces code fields and error messages
- Keyboard navigable entire flow
- High contrast code entry
- Focus management after code submission

UX risks:

- Users may expect email/password option
- Phone number privacy concerns
- International number formatting confusion

Technical risks:

- SMS delivery reliability
- Rate limiting abuse prevention
- Phone verification service scaling

## Source Docs Read

- `zip_extracted/extracted_text/Colors_of_Glory_Screen_1_Phone_Login_UX_Handoff.txt`
- `zip_extracted/extracted_text/master_onboarding_flow.txt`
- `docs/COG-FEATURE-PERFORMANCE-QA-MASTER-PROMPT.md`

Key acceptance criteria from the source docs:

- One H1: `Welcome`
- Phone label must be explicit, not placeholder-only
- Keyboard should be tel/numeric
- Input and button at least 44px high, target 60px
- Inline errors use `aria-live="polite"`
- CTA disabled until number is valid
- Submit creates OTP session and routes to code verification
- Invite/referral/founder context survives the transition
- Small-screen keyboard should not hide the CTA
- First-time user reaches code screen without account setup language
- Invite user authenticates without losing invite context
- Failed OTP send is calm, recoverable, and preserves phone number

## Benchmark References Considered

- [Songcraft](https://songcraft.io/): unified lyrics, chords, tabs, recordings, and collaboration.
- [BandLab](https://www.bandlab.com/): record, mix, and collaborate from a free studio.
- [Soundtrap](https://schools.soundtrap.com/edu/): invite collaborators to record on separate tracks in the browser.
- [Ableton Note](https://www.ableton.com/en/note/manual/): mobile idea sketching, improvisation capture, sampling anywhere.
- [GarageBand Live Loops](https://support.apple.com/en-mide/guide/garageband-iphone/chsca7ff9ced/ios): real-time touch arrangement of musical ideas.
- [Logic Pro for iPad Live Loops](https://support.apple.com/guide/logicpro-ipad/intro-to-live-loops-lpip052333b6/ipados): arrange and play musical ideas in sync with project tempo.
- [Tully](https://tullyapp.com/): lyrics, recordings, contracts, royalties, and artist workflow in one mobile-oriented system.

Benchmark takeaway:

The best music tools remove setup friction before creativity begins. Colors of Glory should beat them here by making access feel like opening a private song room, not launching a production suite. The current client UX now holds that focus; the remaining release issue is the disabled live SMS provider.

## Current Implementation Map

Routes:

- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:123): `/auth/login` email fallback route.
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:124): `/auth/phone` primary phone login route.
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:125): `/auth/phone/verify` primary code verification route.
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:126): `/auth/verify` legacy redirect to `/auth/phone/verify`.
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:139): `/join/:token`
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:141): `/invite/verify`

Core components:

- [PhoneLoginPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\PhoneLoginPage.tsx:10): 10-digit US phone input, `+1` E.164 conversion, Supabase OTP send.
- [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:30): phone display from `sessionStorage`, Supabase OTP verify, post-auth routing.
- [OTPInput.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\OTPInput.tsx:13): 6-box code input with auto-advance, paste support, arrow navigation.
- [OnboardingShell.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\OnboardingShell.tsx:12): cream shell and radial glow.
- [GoldButton.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\GoldButton.tsx:24): 56px gold CTA.
- [InviteJoinPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\invite\InviteJoinPage.tsx:67): invite preview + context save.
- [InviteVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\invite\InviteVerifyPage.tsx:56): invite OTP verify + `acceptInvite`.

Global components affecting auth:

- [GlobalCaptureFlow.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\capture\GlobalCaptureFlow.tsx:35): suppresses itself on auth, onboarding, invite, join, checkout, settings, admin, referral, and owned capture routes.
- [GlobalCaptureFab.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\capture\GlobalCaptureFab.tsx:24): fixed `Record a new idea` button, intentionally absent from phone/auth routes.

## Happy Path QA

Static/code evidence:

- The screen has one semantic H1: `Welcome`.
- The form asks for one field only.
- There is no visible password field and no social login row.
- CTA copy is `Continue`, matching the handoff.
- `signInWithOtp` is called only after a valid 10-digit number is submitted.
- Phone display is stored for the verification screen.
- `/auth/verify` redirects to `/auth/phone/verify`; with no phone session, the verification screen redirects to `/auth/login`.

Browser evidence from local dev at `http://127.0.0.1:5173/auth/phone`:

- HTTP status: 200.
- At `390 x 844`, `h1` is `Welcome`.
- One phone input is present with `type="tel"`, `inputmode="numeric"`, `autocomplete="tel-national"`, placeholder `(555) 555-5555`, and accessible name `Phone number`.
- Continue button is present, 56px high, and disabled before valid input.
- Filling `5555551212` normalizes the display to `(555) 555-1212` and enables Continue.
- No console errors or warnings on the auth route during browser inspection.
- No global capture action is present.

Not tested live:

- I did not submit a phone number in-browser because that would transmit data and attempt an external SMS action.
- A no-cost invalid-number endpoint dry-run was attempted instead and proved the phone provider is disabled.
- Real SMS carrier delivery, OTP expiry, and rate limiting remain unverified in this pass.

## Edge Case QA

Covered by code:

- Invalid/rate/network send errors are mapped to friendly messages in [PhoneLoginPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\PhoneLoginPage.tsx:22).
- Expired/invalid/rate/network verify errors are mapped to friendly messages in [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:13).
- Resend is gated by a 30-second countdown in [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:10).
- Plain Supabase-style error objects with `message` now map correctly instead of falling through as `[object Object]`.

Not covered enough:

- International numbers are not supported: both direct auth and invite auth cap to 10 digits and hardcode `+1`.
- Full invite acceptance after successful OTP still needs an end-to-end mocked route test.
- There is no feature-specific automated test for expired code or resend countdown behavior.

## Mobile UI QA

Browser viewport matrix on local dev:

| Viewport | Overflow | Input | Continue CTA | Extra actions |
|---|---:|---:|---:|---:|
| 390 x 844 | No | visible | visible, 56px | `Use email`, `Preview demo` |

Automated mobile render coverage includes seeded `/auth/phone/verify` at the primary 390px viewport.

Main UI fit is good: no measured offscreen controls at the captured viewport, and no unauthenticated creative-recording action appears.

## Accessibility QA

Passes:

- H1 exists.
- Phone input has `aria-label="Phone number"`.
- Input includes descriptive hint/error IDs.
- Error messages use `role="alert"` and `aria-live="polite"`.
- OTP digits have per-box labels such as `Code digit 1 of 6`.
- OTP supports keyboard backspace and arrow navigation.
- Touch targets meet or exceed 44px.

Resolved in the 2026-06-15 pass:

- The phone input now references `phone-hint` only until an actual `phone-error` node is rendered.
- The global capture FAB is no longer present on `/auth/phone`, `/auth/phone/verify`, `/auth/verify`, `/onboarding/*`, `/invite/*`, or `/join/*`.
- Automated coverage now includes seeded `/auth/phone/verify` mobile rendering, global capture route suppression, and invite OTP rejection copy.

Remaining risks:

- Reduced-motion behavior for global capture pulse states should still be audited on routes where global capture is intentionally visible.
- Live screen-reader behavior still needs a manual device/browser pass before production.

## Performance Evidence

Commands run:

```bash
npm.cmd run test -- src/test/feature001-phone-auth-stress.test.tsx
npm.cmd run test -- src/test/feature04-canvas.test.tsx
npm.cmd run perf:budget
npm.cmd run qa:codex
git diff --check
```

Result: **Feature 001 focused checks passed; full QA gate failed hard checks.**

Feature-specific stress suite:

- `src/test/feature001-phone-auth-stress.test.tsx`: 8 tests passed.
- Covered valid-number gating, E.164 normalization, OTP send setup, provider-disabled/rate-limit/invalid/network copy, OTP paste verification, code-box clearing on rejection, and invite OTP rejection copy.

Passing within the full QA gate:

- Lint passed.
- Typecheck passed.
- Production build completed.
- Auth-specific stress tests passed inside the full suite.
- Old-brand content scan passed.
- Legacy asset filename scan passed.
- Basic accessibility source checks passed.
- Instant-feel source checks passed.
- Placeholder route scan passed.
- Production preview route smoke passed: 28 routes.

Failing within the full QA gate:

- Full Vitest run: 12 files passed, 1 file failed. `src/test/feature04-canvas.test.tsx` timed out in the first test at the 5,000ms suite limit.
- Isolated rerun of `npm.cmd run test -- src/test/feature04-canvas.test.tsx` passed 3/3 in 3.82s, so this looks like suite timing pressure rather than an auth-path regression.
- Bundle budget: `BrainstormPage-GZHUXPv2.js` is 32.4 kB raw and exceeds the 15.6 kB route budget.

Warnings observed:

- Browserslist data is 12 months old.
- `SeedIdeasShelf` emits an existing React `act(...)` warning in the mobile render suite.
- Shared/vendor warning: `index-CUFILGTT.js` is 566.9 kB raw / 168.8 kB gzip. It is not counted as a route chunk by the current budget script but should be audited before production launch.

Auth-specific chunks are healthy:

- `PhoneLoginPage-DP99fZdF.js`: 4.12 kB raw / 1.89 kB gzip.
- `CodeVerifyPage-DDLkbbL_.js`: 3.77 kB raw / 1.71 kB gzip.
- `InviteJoinPage-ChhWz5BB.js`: 10.14 kB raw / 3.63 kB gzip.
- `InviteVerifyPage-DOVE1na8.js`: 3.32 kB raw / 1.59 kB gzip.

Browser evidence from local dev server at `http://127.0.0.1:5173/auth/phone`:

- Private preview gate did not block this run because the browser session was already unlocked from the prior local audit; no code changes were made for this.
- Viewport: 390 x 844.
- `/auth/phone`: H1 `Welcome`, phone input `type="tel"`, `inputmode="numeric"`, `autocomplete="tel-national"`, placeholder `(555) 555-5555`.
- Initial `aria-describedby` was `phone-hint`, and every referenced ID existed.
- Continue CTA was disabled before valid input and measured 56px high.
- After filling `5555551212`, the display normalized to `(555) 555-1212` and Continue enabled. Continue was not clicked in-browser to avoid sending an OTP.
- No `Record a new idea` action was present.
- No horizontal overflow and no browser console warnings/errors were observed.
- `/auth/verify` redirected to `/auth/phone/verify`, then to `/auth/login` when no phone session was present.
- `/invite/verify` with no phone session redirected to `/invite/demo`; no global capture or overflow was observed.

Twilio/Supabase endpoint dry-run:

- Deno runner present in repo but not executable locally because `deno` is not installed.
- No private `scripts/stress/phones.json` is present.
- Node invalid-number dry-run made 5 POSTs to `/auth/v1/otp`.
- Result: 5/5 HTTP 400 responses with `phone_provider_disabled`, first message `Unsupported phone provider`, latency range 121-935ms, `liveSmsSent: false`.
- Interpretation: live SMS login is blocked by Supabase/Twilio phone provider configuration, not by the client route.

## Data, Permissions, And Integrity QA

Direct auth:

- Uses Supabase phone OTP send and verify directly from the route components.
- Stores phone display and E.164 phone in `sessionStorage`.
- Routes after auth based on pending checkout, legacy invite token, or whether the user has songs.

Invite auth:

- `/join/:token` loads invite preview and saves token, song ID, inviter, role, lyrics snippet, and collaborator metadata.
- Existing phone check debounces after a valid 10-digit phone.
- New invite users receive OTP, then `/invite/verify` calls `acceptInvite`.

Risks:

- Live phone auth is not enabled in the connected Supabase project: `/auth/v1/otp` returns `phone_provider_disabled`.
- Direct auth and invite auth use two different context mechanisms (`cog:invite-token` vs `cog:invite-context`), creating a regression risk for deep-link invite continuity.
- Direct login does not appear to log auth attempts/device info in the client path. The spreadsheet requires security audit logging; this may be server-side only, but I did not find direct evidence in this pass.
- Phone number privacy reassurance is functional but thin. It says a code will be sent, but does not explain privacy or why phone is used.

## Findings

### P0 - Supabase/Twilio Phone Provider Is Disabled

The no-cost OTP endpoint dry-run returned `phone_provider_disabled` on 5 of 5 fresh attempts. The client now maps this to calm recovery copy, but real Church Center-style SMS login cannot work until Supabase Phone Auth and Twilio credentials/templates are enabled for the project behind the current public env.

Fix:

- Enable/configure Supabase Phone Auth with the intended Twilio sender.
- Confirm allowed regions, SMS templates, rate limits, and test OTP numbers.
- Run `scripts/stress/otp-send.ts --mode=test-numbers` after Deno is installed and Supabase test numbers are configured.
- Run a low-volume `canary` with an explicitly approved real test number before release.

### P0 - Current App-Level QA Gate Is Red

The phone-login client checks passed, but `npm.cmd run qa:codex` failed hard checks in the fresh 2026-06-16 run. The full test suite had a Feature 04 canvas timeout, and the bundle budget failed because `BrainstormPage-GZHUXPv2.js` is 32.4 kB against a 15.6 kB route budget.

Fix:

- Stabilize the full-suite Feature 04 canvas test or raise its timeout with evidence that render work is legitimately slow.
- Bring the Brainstorm route chunk back under the configured route budget or update the budget policy intentionally.
- Re-run the full QA gate before changing Feature 001 to Pass.

### P1 - International Phone Support Is Hardcoded Out

Direct and invite phone auth both use `DIGITS_MAX = 10` and `toE164(digits) => +1${digits}`. The spreadsheet explicitly calls out international number confusion as a UX risk, and the handoff calls for an integrated country selector.

Fix:

- Introduce a shared `PhoneNumberInput` using a country selector and proper E.164 parsing.
- At minimum, make `+1` visually explicit as US/Canada-only and provide a working alternate method before international launch.

### P1 - Invite Context Is Split Across Auth Paths

`CodeVerifyPage` routes legacy `cog:invite-token` to `/invite/:token`, while `/join/:token` uses `saveInviteContext` and `/invite/verify`. Both may be valid paths, but Feature 1's acceptance gate depends on invite context surviving auth consistently.

Fix:

- Consolidate invite context handling.
- Add an automated test for direct invite deep link -> phone entry -> OTP verify -> accepted song room.

### P2 - Phone Privacy Reassurance Is Too Thin

The screen says "We'll send a secure one-time code. No password needed." That is accurate, but users with privacy concerns may still wonder whether their number is visible to collaborators or used for marketing.

Fix:

- Add one quiet line or disclosure sheet: "Your number is used to verify access, not shown inside song rooms."

### P2 - Visual Screenshot Artifact Still Missing

Browser DOM and layout metrics were collected through the in-app browser, but no screenshot artifact was captured in this pass.

Fix:

- Add a Playwright screenshot script outside the in-app browser or repair screenshot capture in the browser QA setup.

## Missing Tests

Now covered:

- Direct phone login valid-number enables CTA.
- Phone submit calls OTP service and preserves phone display.
- Provider-disabled, invalid phone, rate-limit, and network send errors preserve the typed number.
- `/auth/phone/verify` mobile render with seeded phone session.
- OTP paste and auto-submit rejection cleanup.
- Invite OTP rejection copy for Supabase-style plain error objects.
- Global capture is hidden on auth/onboarding/invite routes.

Still missing:

- Live test-number OTP send and verify through Supabase Phone Auth with Twilio enabled.
- Real canary SMS delivery across at least one approved test device/carrier.
- OTP expiry and resend countdown integration tests.
- Full invite link -> phone auth -> invite acceptance -> exact song route.
- International or non-US phone handling.
- Explicit phone privacy reassurance behavior/copy test if added.

## Recommended Fix Order

1. Enable Supabase Phone Auth/Twilio for the current environment.
2. Install Deno or port the stress runner to Node so the repo stress command is executable on this machine.
3. Run no-cost `test-numbers` OTP stress after Supabase test OTP numbers are configured.
4. Run an explicitly approved real-number canary with low volume.
5. Consolidate direct and invite auth context.
6. Replace hardcoded US phone formatting with shared E.164 parsing or explicitly scope launch to US/Canada.
7. Add full invite acceptance and OTP expiry/resend integration coverage.

## Acceptance Gate

Feature 1 can move to Pass only when:

- `npm.cmd run qa:codex` passes.
- Supabase Phone Auth/Twilio is enabled for the release environment.
- No-cost test-number OTP stress passes without `phone_provider_disabled`.
- An explicitly approved live canary proves SMS send and code verification.
- `/auth/phone` has exactly the intended login actions and no global capture/action leakage.
- `/auth/phone/verify` has mobile render and OTP behavior tests.
- Invite context survives the full phone-code path in an automated test.
- The product supports international phone numbers or explicitly scopes the first release to US/Canada with a graceful fallback.
- A live or mocked SMS send/verify test proves wrong code, expired code, resend, and rate limit states.

## Next Feature To Audit

Feature 002: `0.2 Click-to-Sequence Voice Memo Playback Mode (Listen Path)`

