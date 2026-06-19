# Feature 001 Next 10 Prompt Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Feature 001 from "client UX passes, live Twilio blocked" to a release-ready Church Center-style phone login flow with green app-level QA.

**Architecture:** Treat auth UX, QA health, Twilio provider configuration, stress testing, invite continuity, and phone-number scope as separate workstreams. Execute one prompt at a time, record evidence, and do not mark Feature 001 passing until live provider configuration and full QA are green.

**Tech Stack:** Vite, React 18, TypeScript, React Router, Supabase Auth Phone OTP, Vitest, local Codex QA gate, GitHub PR workflow.

---

## Prompt 1: Open The Draft PR

**Use this prompt:**

You are a senior release engineer preparing the already-pushed branch `codex/feature-001-auth-audit` for review. Open a draft GitHub pull request from `codex/feature-001-auth-audit` into `main` for `VeePo-Web/colorsofglory.app`. The PR must be honest: Feature 001 auth UX is improved and audited, live Twilio remains blocked by `phone_provider_disabled`, and the latest app-level QA gate is red for non-auth reasons.

PR title:
`[codex] Prepare Feature 001 auth audit`

PR body:
```markdown
## Summary

- Updates Feature 001 phone-login audit evidence and route mapping for `/auth/phone`, `/auth/phone/verify`, and legacy `/auth/verify`.
- Hides global capture from auth/onboarding/invite surfaces through route-policy coverage.
- Adds mocked Supabase/Twilio OTP stress coverage for direct phone login and invite OTP rejection paths.
- Improves phone/OTP error handling for Supabase-style plain `{ code, message }` objects.
- Expands Codex QA route/mobile coverage around phone auth and verification.

## Current Status

Client UX is ready for a clean UX re-audit, but Feature 001 is not release-ready yet.

Known blockers:
- Supabase Phone Auth/Twilio returns `phone_provider_disabled` on safe invalid-number OTP dry runs.
- Latest full `npm.cmd run qa:codex` is red for non-auth reasons:
  - Feature 04 canvas test timed out in the full suite, though isolated rerun passed.
  - `BrainstormPage-GZHUXPv2.js` exceeds the route budget.

## Validation

- `npm.cmd run test -- src/test/feature001-phone-auth-stress.test.tsx` passed: 8/8.
- Browser audit at 390 x 844 for `/auth/phone` passed without sending live SMS.
- Safe invalid-number OTP endpoint dry-run returned `phone_provider_disabled`, `liveSmsSent: false`.
- `git diff --check` passed.

## Not Done

- Live Twilio/Supabase Phone Auth configuration.
- No-cost test-number OTP stress.
- Real SMS canary.
- Full app-level QA green gate.
```

Steps:
- [x] Verify local branch with `git status --short --branch`.
- [x] Verify the remote branch exists with `git ls-remote --heads origin codex/feature-001-auth-audit`.
- [x] Push any local commits so remote branch matches local branch.
- [x] Attempt to create the draft PR using available GitHub tooling.
- [x] If PR creation tooling is forbidden/unavailable, return the exact URL, title, and body above as the manual creation artifact.

Acceptance criteria:
- A draft PR URL exists, or a precise blocker explains why PR creation cannot be completed from the current environment.
- No source files are changed by this prompt.

---

## Prompt 2: Restore The App-Level QA Gate

**Use this prompt:**

You are a principal quality engineer restoring the Codex QA gate. Start from `docs/codex-feature-audits/feature-001-church-center-phone-login.md`. Target a green `npm.cmd run qa:codex` without weakening the gate casually.

Root causes to investigate:
- Full-suite Vitest timeout in `src/test/feature04-canvas.test.tsx`, first test, 5,000ms limit.
- Bundle budget failure: `BrainstormPage-GZHUXPv2.js` is 32.4 kB raw and exceeds the 15.6 kB route budget.

Hard constraints:
- Do not skip tests.
- Do not raise budgets unless evidence proves the budget is wrong.
- Do not delete canvas assertions.
- Preserve Feature 001 auth tests.

Steps:
- [ ] Run `npm.cmd run test -- src/test/feature04-canvas.test.tsx` and record timing.
- [ ] Run full `npm.cmd run test` to see whether the timeout repeats.
- [ ] Run `npm.cmd run build` then `npm.cmd run perf:budget`.
- [ ] Inspect `dist/assets` to confirm the current largest route chunk.
- [ ] If the canvas timeout repeats only in full suite, reduce render/query cost or add a narrowly justified per-test timeout.
- [ ] If Brainstorm remains over budget, execute Prompt 3.
- [ ] Finish only after `npm.cmd run qa:codex` passes from a clean run.

Acceptance criteria:
- `npm.cmd run qa:codex` exits 0.
- The audit doc is updated with exact green-gate evidence.

---

## Prompt 3: Split Or Lazy-Load BrainstormPage

**Use this prompt:**

You are a senior frontend performance engineer reducing the `BrainstormPage` route chunk under the configured 16 kB raw route budget. Make the route lightweight; do not hide the failure by changing the checker first.

Files to inspect:
- `src/pages/BrainstormPage.tsx`
- `src/App.tsx`
- `vite.config.ts`
- `scripts/check-bundle-budget.mjs`
- Any components imported synchronously by `BrainstormPage`

Likely strategy:
- Move heavy UI sections, libraries, or rarely-opened panels behind `React.lazy`.
- Keep the route shell lightweight.
- Avoid importing large icon sets or rich components directly when they can be deferred.
- Prefer local dynamic imports over global manual chunk changes unless the dependency is truly shared.

Verification:
- [ ] Run `npm.cmd run build` and `npm.cmd run perf:budget` before changes to verify red.
- [ ] Implement the smallest lazy-loading split.
- [ ] Run `npm.cmd run build` and `npm.cmd run perf:budget` again.
- [ ] Run `npm.cmd run test -- src/test/codex-mobile-render.test.tsx`.

Acceptance criteria:
- `BrainstormPage-*.js` is below 16 kB raw, or heavy work is deferred into non-route chunks intentionally.
- QA route smoke still loads Brainstorm routes if configured.

---

## Prompt 4: Stabilize Feature 04 Canvas Test

**Use this prompt:**

You are a test reliability engineer. The first test in `src/test/feature04-canvas.test.tsx` timed out at 5,000ms only during the full suite while the isolated file passed. Diagnose and stabilize it without weakening behavioral coverage.

Files:
- `src/test/feature04-canvas.test.tsx`
- Components rendered by that test
- Vitest setup files

Steps:
- [ ] Run the single file three times and record durations.
- [ ] Run the full test suite once and confirm whether timeout repeats.
- [ ] Inspect broad queries, animations, timers, and async waits.
- [ ] Replace broad queries/waits with targeted queries where possible.
- [ ] If render work legitimately needs more than 5 seconds under full-suite pressure, apply a targeted timeout with a comment explaining why.
- [ ] Do not remove assertions for the root song card or thumb actions.

Acceptance criteria:
- `npm.cmd run test -- src/test/feature04-canvas.test.tsx` passes.
- Full `npm.cmd run test` passes.

---

## Prompt 5: Enable Supabase Phone Auth And Twilio

**Use this prompt with the Supabase/Twilio operator:**

You are configuring live phone authentication for Colors of Glory. The frontend is already prepared for Supabase Phone OTP. The current blocker is `/auth/v1/otp` returning `phone_provider_disabled`.

Required setup:
- Enable Supabase Auth > Phone provider.
- Configure Twilio Account SID, Auth Token, and approved sender/messaging service.
- Configure launch SMS regions.
- Configure OTP template: `Your Colors of Glory code is {{ .Code }}. It expires soon.`
- Configure Supabase test OTP numbers for no-cost stress testing.
- Confirm rate limits and abuse protections.

Evidence to return:
- Supabase project/environment name.
- Phone provider enabled status.
- Twilio sender/messaging service.
- Allowed regions.
- Test OTP numbers configured.
- Provider-enabled screenshot or copied status summary.

Acceptance criteria:
- Safe OTP endpoint calls no longer return `phone_provider_disabled`.
- Test OTP numbers can send and verify without real SMS cost.

---

## Prompt 6: Make OTP Stress Runner Executable Locally

**Use this prompt:**

You are a tooling engineer making the OTP stress runner executable on this Windows repo without requiring Deno. The existing Deno script is `scripts/stress/otp-send.ts`; local `deno` is not installed.

Recommended approach:
- Create `scripts/stress/otp-send.mjs` as a Node-compatible equivalent.
- Keep modes: `test-numbers`, `canary`, `dry-run`.
- Keep `canary` visibly real-SMS and cost-bearing.
- Read `.env` and `.env.development` without adding dependencies.
- Use `scripts/stress/phones.json` if present; otherwise `phones.example.json`.
- Mask real phone numbers in summaries.

Files:
- Create: `scripts/stress/otp-send.mjs`
- Modify: `package.json` with `"stress:otp": "node scripts/stress/otp-send.mjs"`

Verification:
- [ ] `npm.cmd run stress:otp -- --mode=dry-run --rps=1 --duration=3`
- [ ] Confirm result has `liveSmsSent: false`.
- [ ] Confirm missing env exits clearly.

Acceptance criteria:
- Stress runner works locally without Deno.
- It cannot send canary SMS unless `--mode=canary` is explicit.

---

## Prompt 7: Run No-Cost Test-Number OTP Stress

**Use this prompt after Prompt 5 and Prompt 6:**

You are validating Supabase Phone Auth with configured test OTP numbers only. Do not send real SMS.

Command:
```powershell
npm.cmd run stress:otp -- --mode=test-numbers --rps=2 --duration=30
```

Measure:
- Total requests.
- 2xx success count.
- Error code distribution.
- p50/p95/p99 latency.
- Whether `phone_provider_disabled` appears.
- Whether any request uses canary mode.

Acceptance criteria:
- High success rate, ideally 100 percent for test numbers.
- No real SMS sent.
- No `phone_provider_disabled`.
- Results added to the Feature 001 audit.

---

## Prompt 8: Run One Real SMS Canary

**Use this prompt only after explicit approval of a real phone number:**

You are the release canary operator. Send one low-volume real SMS OTP to an approved test device and verify the full login route. This sends real SMS and may cost money.

Procedure:
- Put exactly one approved real phone number in `scripts/stress/phones.json` under `canary`.
- Run `npm.cmd run stress:otp -- --mode=canary --concurrency=1`.
- On the device, confirm receipt time and code delivery.
- In the browser, complete `/auth/phone` -> `/auth/phone/verify`.
- Confirm post-auth routing.

Evidence:
- Timestamp.
- Carrier/device type.
- Delivery latency.
- Verification result.
- Final route after login.

Acceptance criteria:
- One real OTP is delivered and verifies successfully.
- No duplicate messages.
- No route/context loss.

---

## Prompt 9: Unify Invite Auth Context

**Use this prompt:**

You are removing an invite regression trap. Direct phone auth checks `cog:invite-token`, while the invite flow uses `cog:invite-context`. Build one reliable context path so invite link -> phone entry -> OTP verify -> accepted song route is deterministic.

Files:
- `src/pages/auth/CodeVerifyPage.tsx`
- `src/pages/invite/InviteJoinPage.tsx`
- `src/pages/invite/InviteVerifyPage.tsx`
- `src/lib/invite/inviteContext.ts`
- Add: `src/test/feature001-invite-phone-flow.test.tsx`

TDD:
- [ ] Write a failing test that seeds `cog:invite-context`, submits OTP, calls mocked `acceptInvite`, and lands on the expected route.
- [ ] Write a failing test for legacy `cog:invite-token` compatibility.
- [ ] Implement the smallest routing/context change.
- [ ] Run `npm.cmd run test -- src/test/feature001-invite-phone-flow.test.tsx`.
- [ ] Run `npm.cmd run test -- src/test/feature001-phone-auth-stress.test.tsx`.

Acceptance criteria:
- Invite context survives phone auth.
- Legacy behavior remains compatible or is intentionally migrated with tests.
- No unauthenticated global capture leaks into invite auth.

---

## Prompt 10: Make Phone Scope Explicit

**Use this prompt:**

You are resolving international phone ambiguity for first release. The UI hardcodes `+1` and accepts 10 digits. Choose the smallest honest release-safe approach unless international launch is committed.

Recommended first-release approach:
- Keep `+1`.
- Add copy: `US & Canada numbers only for this preview.`
- Add privacy reassurance: `Your number verifies access and is not shown inside song rooms.`
- Keep email fallback visible and working.

Files:
- `src/pages/auth/PhoneLoginPage.tsx`
- `src/pages/invite/InviteJoinPage.tsx`
- `src/test/feature001-phone-auth-stress.test.tsx`
- `src/test/codex-mobile-render.test.tsx`
- `docs/codex-feature-audits/feature-001-church-center-phone-login.md`

TDD:
- [ ] Add assertions that US/Canada-only copy renders on direct phone login and invite phone entry.
- [ ] Add assertions that privacy reassurance renders.
- [ ] Implement calm Colors of Glory copy.
- [ ] Run `npm.cmd run test -- src/test/feature001-phone-auth-stress.test.tsx src/test/codex-mobile-render.test.tsx`.

Acceptance criteria:
- Users are not misled into expecting international support.
- Privacy concern is addressed without clutter.
- Mobile fit remains clean at 390px.

---

## Execution Log

- 2026-06-18 Prompt 1: Verified remote branch `origin/codex/feature-001-auth-audit` at `09e3e331f08691f675d9e850ec2d8cdad58a31be`, found local branch ahead at `ec877c83bb76dae4cdb4e32cf5762c53603dc082`, pushed it to origin, then attempted draft PR creation through the GitHub connector. PR creation failed with `403 Resource not accessible by integration`; use `https://github.com/VeePo-Web/colorsofglory.app/pull/new/codex/feature-001-auth-audit` with the title/body in Prompt 1.
