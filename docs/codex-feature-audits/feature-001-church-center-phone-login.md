# Feature 001 Audit: Church Center-Style Phone Number Login UX

Date: 2026-06-11  
Spreadsheet label: `0.1`  
Verdict: **Fail**

## Feature Identity

Feature name: Church Center-Style Phone Number Login UX  
Category: Settings  
Priority: Critical  
Phase: Phase 1  
Primary route map: `/auth/login`, `/auth/verify`, `/join/:token`, `/invite/verify`

Product intent:

This feature exists so worship leaders, songwriters, and invited collaborators can enter a private song room with phone-code familiarity, no password burden, and no account-setup anxiety.

Core songwriter question:

If I am writing a worship song and inspiration is fragile, does this feature help me move faster, calmer, and with more confidence?

Current answer: **partly, but not enough for release.** The visible login page is close to the handoff, but global capture leaks onto auth, the full QA gate is red, international phone support is not handled, and direct auth context preservation is incomplete relative to the spec.

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

The best music tools remove setup friction before creativity begins. Colors of Glory should beat them here by making access feel like opening a private song room, not launching a production suite. The current login almost does that, but the global capture FAB and demo shortcut weaken the trust-contract moment.

## Current Implementation Map

Routes:

- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:101): `/auth/login`
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:102): `/auth/verify`
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:116): `/join/:token`
- [src/App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:118): `/invite/verify`

Core components:

- [PhoneLoginPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\PhoneLoginPage.tsx:10): 10-digit US phone input, `+1` E.164 conversion, Supabase OTP send.
- [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:30): phone display from `sessionStorage`, Supabase OTP verify, post-auth routing.
- [OTPInput.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\OTPInput.tsx:13): 6-box code input with auto-advance, paste support, arrow navigation.
- [OnboardingShell.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\OnboardingShell.tsx:12): cream shell and radial glow.
- [GoldButton.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\cog\GoldButton.tsx:24): 56px gold CTA.
- [InviteJoinPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\invite\InviteJoinPage.tsx:67): invite preview + context save.
- [InviteVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\invite\InviteVerifyPage.tsx:56): invite OTP verify + `acceptInvite`.

Global components affecting auth:

- [GlobalCaptureFlow.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\capture\GlobalCaptureFlow.tsx:35): only suppresses itself on canvas and voice routes.
- [GlobalCaptureFab.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\capture\GlobalCaptureFab.tsx:24): fixed `Record a new idea` button, mounted on `/auth/login`.

## Happy Path QA

Static/code evidence:

- The screen has one semantic H1: `Welcome`.
- The form asks for one field only.
- There is no visible password field and no social login row.
- CTA copy is `Continue`, matching the handoff.
- `signInWithOtp` is called only after a valid 10-digit number is submitted.
- Phone display is stored for the verification screen.
- `/auth/verify` redirects back to `/auth/login` when no phone session exists.

Browser evidence from production preview at `http://127.0.0.1:4173/auth/login`:

- HTTP status: 200.
- At `390 x 844`, `h1` is `Welcome`.
- One phone input is present with `type="tel"`, `inputmode="numeric"`, `autocomplete="tel-national"`, placeholder `(555) 555-5555`, and accessible name `Phone number`.
- Continue button is present, 56px high, and disabled before valid input.
- No console errors or warnings on the auth route during browser inspection.
- DOM size is small: 37 body descendants, 1 input, 4 buttons.

Not tested live:

- I did not submit a phone number in-browser because that would transmit data and attempt an external SMS action.
- Real SMS carrier delivery, OTP expiry, and rate limiting remain unverified in this pass.

## Edge Case QA

Covered by code:

- Invalid/rate/network send errors are mapped to friendly messages in [PhoneLoginPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\PhoneLoginPage.tsx:22).
- Expired/invalid/rate/network verify errors are mapped to friendly messages in [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:13).
- Resend is gated by a 30-second countdown in [CodeVerifyPage.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\pages\auth\CodeVerifyPage.tsx:10).

Not covered enough:

- International numbers are not supported: both direct auth and invite auth cap to 10 digits and hardcode `+1`.
- Email fallback is visible but has no `onClick` behavior on the direct login page.
- The direct `/auth/login` path only preserves `cog:phone-e164` and `cog:phone-display` on submit; invite preservation depends on `cog:invite-token` already existing in session storage.
- There is no feature-specific automated test for wrong code, expired code, resend, or rate-limit copy.

## Mobile UI QA

Browser viewport matrix on production preview:

| Viewport | Overflow | Input | Continue CTA | Extra actions |
|---|---:|---:|---:|---:|
| 390 x 844 | No | visible | visible, 56px | `Use email`, `Preview demo`, `Record a new idea` |
| 430 x 932 | No | visible | visible, 56px | same |
| 768 x 1024 | No | visible | centered, 56px | same |
| 1440 x 900 | No | visible | centered, 56px | same |

Note: the browser viewport capability reported 390px for the attempted 375px width, so the 375px narrow check was not trustworthy in this run.

Main UI fit is good: no measured offscreen controls at the captured viewports. The problem is conceptual, not layout: an unauthenticated page has a floating creative-recording action.

## Accessibility QA

Passes:

- H1 exists.
- Phone input has `aria-label="Phone number"`.
- Input includes descriptive hint/error IDs.
- Error messages use `role="alert"` and `aria-live="polite"`.
- OTP digits have per-box labels such as `Code digit 1 of 6`.
- OTP supports keyboard backspace and arrow navigation.
- Touch targets meet or exceed 44px.

Fails / risks:

- `aria-describedby="phone-hint phone-error"` points to `phone-error` even before that element exists. Usually survivable, but cleaner to only reference existing nodes or always render a visually hidden error container.
- The global capture FAB is keyboard/screen-reader reachable on auth as `Record a new idea`, creating an irrelevant action before identity is established.
- Reduced-motion behavior for the global capture pulse is not guarded by `prefers-reduced-motion`.
- No automated accessibility test covers `/auth/verify` mobile rendering or the invite OTP route.

## Performance Evidence

Command run:

```bash
npm.cmd run qa:codex
```

Result: **failed hard checks**.

Passing within the gate:

- Production build completed.
- Vitest completed: 6 files, 27 tests passed.
- Old-brand content scan passed.
- Legacy asset filename scan passed.
- Basic accessibility source checks passed.
- Instant-feel source checks passed.
- Placeholder route scan passed.
- Production preview route smoke passed: 26 routes.

Failing within the gate:

- Lint failed:
  - [MiniPracticePlayer.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\components\practice\MiniPracticePlayer.tsx:93): unused expression.
- Typecheck failed:
  - `src/lib/practice/practiceApi.ts(94,19)`: missing `transcript_text` column in Supabase generated type query.
  - `src/pages/CapturePage.tsx(23,3)`: `Waveform` is not exported by `lucide-react`.
  - `src/pages/CapturePage.tsx(486,65)`: `RecordingWaveform` does not accept `height`.
- Bundle budget failed:
  - Main JS: 561.0 kB raw / 167.1 kB gzip, over budget.
  - Main CSS: 89.5 kB raw, over budget.
  - `CapturePage` route chunk: 143.8 kB raw, over route budget.
  - `PracticePlayerPage` route chunk: 34.2 kB raw, over route budget.

Auth-specific chunks are healthy:

- `PhoneLoginPage-BvgHkjo8.js`: 3,927 bytes raw.
- `CodeVerifyPage-DaLQC-F2.js`: 3,623 bytes raw.
- `InviteJoinPage-F-Vb77hH.js`: 10,155 bytes raw.
- `InviteVerifyPage-DwJnjPsY.js`: 3,193 bytes raw.

Browser screenshot attempt:

- Viewport screenshot and full-page screenshot both timed out in the browser backend with `Page.captureScreenshot`.
- No screenshot artifact was produced.

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

- Direct auth and invite auth use two different context mechanisms (`cog:invite-token` vs `cog:invite-context`), creating a regression risk for deep-link invite continuity.
- Direct login does not appear to log auth attempts/device info in the client path. The spreadsheet requires security audit logging; this may be server-side only, but I did not find direct evidence in this pass.
- Phone number privacy reassurance is functional but thin. It says a code will be sent, but does not explain privacy or why phone is used.

## Findings

### P0 - Repo QA Gate Is Red

The feature cannot be release-cleared while `npm.cmd run qa:codex` fails lint, typecheck, and bundle budget. Some failures are outside auth, but the audit standard is app-level because login is the first production surface.

Fix:

- Resolve the lint/typecheck blockers before re-auditing Feature 1.
- Split or defer global capture/practice code so root bundle returns under budget.
- Keep auth routes isolated from heavy creative tooling.

### P1 - Global Capture FAB Mounts On The Phone Login Screen

`GlobalCaptureFlow` is mounted globally in [App.tsx](C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\src\App.tsx:172) and only opts out for canvas/voice routes. Browser DOM on `/auth/login` exposes a fourth button: `Record a new idea`. This directly violates the handoff's "one field, one button, no creative/admin friction before identity" rule.

Fix:

- Suppress global capture on all unauthenticated and onboarding auth routes: `/auth/*`, `/invite/*`, `/join/*`, `/onboarding/*`, `/upgrade`, `/pricing`, `/checkout/*`, `/settings/*`, and admin routes.
- Prefer an explicit allowlist: show global capture only on authenticated song/catalog/workspace routes where capture is meaningful.

### P1 - International Phone Support Is Hardcoded Out

Direct and invite phone auth both use `DIGITS_MAX = 10` and `toE164(digits) => +1${digits}`. The spreadsheet explicitly calls out international number confusion as a UX risk, and the handoff calls for an integrated country selector.

Fix:

- Introduce a shared `PhoneNumberInput` using a country selector and proper E.164 parsing.
- At minimum, make `+1` visually explicit as US/Canada-only and provide a working alternate method before international launch.

### P1 - Email Fallback Is Visible But Nonfunctional On Direct Login

The direct phone login screen renders `Use email instead`, but the button has no click handler. This is worse than hiding it because it promises recovery but does nothing.

Fix:

- Either wire the email fallback to a real email-code flow preserving auth context or hide it until implemented.

### P1 - Invite Context Is Split Across Auth Paths

`CodeVerifyPage` routes legacy `cog:invite-token` to `/invite/:token`, while `/join/:token` uses `saveInviteContext` and `/invite/verify`. Both may be valid paths, but Feature 1's acceptance gate depends on invite context surviving auth consistently.

Fix:

- Consolidate invite context handling.
- Add an automated test for direct invite deep link -> phone entry -> OTP verify -> accepted song room.

### P2 - `/auth/verify` Is Not Included In 390px Mobile Render Tests

The route smoke includes `/auth/verify`, but `mobileRenderRoutes` includes `/auth/login` only. The OTP screen is half the feature and needs mobile coverage.

Fix:

- Add a mobile render test for `/auth/verify` with seeded session storage.
- Add tests for OTP auto-advance, paste, resend countdown, wrong-code copy, and change-number behavior.

### P2 - Phone Privacy Reassurance Is Too Thin

The screen says "We'll send a secure one-time code. No password needed." That is accurate, but users with privacy concerns may still wonder whether their number is visible to collaborators or used for marketing.

Fix:

- Add one quiet line or disclosure sheet: "Your number is used to verify access, not shown inside song rooms."

### P2 - Screenshot Evidence Blocked

Browser screenshot capture timed out twice. The DOM and layout metrics were collected, but visual artifact capture needs a reliable path.

Fix:

- Repair the screenshot path in the browser QA setup or add a Playwright screenshot script outside the in-app browser.

## Missing Tests

- Direct phone login valid-number enables CTA.
- Phone submit calls OTP service and preserves phone display.
- Invalid phone and rate-limit errors preserve the typed number.
- Email fallback behavior.
- `/auth/verify` mobile render with seeded phone session.
- OTP paste and auto-submit.
- OTP wrong-code/expired-code/rate-limit copy.
- Invite link -> phone auth -> invite acceptance -> exact song route.
- Global capture is hidden on all auth/onboarding routes.
- International or non-US phone handling.

## Recommended Fix Order

1. Hide global capture on auth/onboarding/invite routes.
2. Wire or remove the email fallback.
3. Add `/auth/verify` seeded mobile render tests.
4. Consolidate direct and invite auth context.
5. Replace hardcoded US phone formatting with shared E.164 parsing.
6. Add auth-specific Vitest tests with mocked Supabase OTP calls.
7. Fix repo-wide lint/typecheck/budget failures before release gating.

## Acceptance Gate

Feature 1 can move to Pass only when:

- `npm.cmd run qa:codex` passes.
- `/auth/login` has exactly the intended login actions and no global capture/action leakage.
- `/auth/verify` has mobile render and OTP behavior tests.
- Email fallback either works or is absent.
- Invite context survives the full phone-code path in an automated test.
- The product supports international phone numbers or explicitly scopes the first release to US/Canada with a graceful fallback.
- A live or mocked SMS send/verify test proves wrong code, expired code, resend, and rate limit states.

## Next Feature To Audit

Feature 002: `0.2 Click-to-Sequence Voice Memo Playback Mode (Listen Path)`

