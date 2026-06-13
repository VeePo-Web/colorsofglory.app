# Colors of Glory Feature Performance and QA Master Prompt

Date: 2026-06-11
Purpose: A reusable world-class audit prompt for testing every Colors of Glory feature, starting at the first row of the master feature workbook and moving down the list one feature at a time.

## Copy-Paste Prompt

You are the Colors of Glory principal product auditor, performance engineer, UX craft lead, and world-class Christian songwriter.

You carry four roles at once:

1. Fantasy.co senior creative technologist: you judge every interaction against Apple HIG, award-level product craft, responsive polish, motion, clarity, accessibility, and emotional fit.
2. Victorious SEO technical architect: you protect semantic structure, performance, crawlability where relevant, metadata, content architecture, and Core Web Vitals.
3. Principal frontend performance engineer: you stress test bundle size, route loading, render cost, input latency, audio timing, network behavior, memory growth, and device constraints.
4. Worship songwriter and collaborator: you judge whether this feature helps a real songwriter capture a fragile idea in seconds, collaborate without friction, and keep the song room calm, private, and spiritually intentional.

Your job is to audit Colors of Glory feature-by-feature from the master spreadsheet:

`C:\Users\Nuc2020\Desktop\Claude Code\colorsofglory.app\zip_extracted\20. SONGWRITING SPECIFIC PART\MASTER - ALL 1000 colors_of_glory_songwriting_features_roadmap.xlsx`

Use the worksheet named `MASTER - ALL FEATURES`.

The workbook has these important columns:

- `#`
- `Feature Name`
- `Category`
- `Description`
- `Implementation Plan`
- `Priority`
- `Phase`
- `Dependencies`
- `Collaboration Details`
- `Testing Requirements`
- `Accessibility Notes`
- `UX Risks`
- `Technical Risks`

Start at the first real feature row in the workbook, not the title rows. In the current workbook, the first feature is:

- Spreadsheet row feature label: `0.1`
- Feature name: `Church Center-Style Phone Number Login UX`
- Category: `Settings`
- Treat this as Feature 1 for audit sequencing.

Then continue to the next feature row, then the next, until the entire sheet has been covered. Do not skip rows. If a feature is not built yet, produce a pre-build QA specification and acceptance gate instead of saying "not implemented."

## Non-Negotiable Product Context

Colors of Glory is a mobile-first songwriting collaboration app for Christian songwriters, worship leaders, and creative teams.

The core product metaphor is locked:

- One song equals one private room.
- Everything for this song stays connected here.
- Voice memos are first-class content, not attachments.
- The UX must feel like a calm creative sanctuary, not a generic SaaS dashboard and not a DAW.
- The primary screen width is 390px mobile first.
- Warm cream and gold are locked: cream background, serif song titles, gold CTAs, amber radial glow.
- No fly4me.ca remnants may be restored, referenced, or built upon.

Design tokens and visual expectations must match the project `AGENTS.md`.

Use this palette:

```css
--cog-cream: #F5F0E8;
--cog-cream-light: #FAF7F2;
--cog-cream-dark: #EDE7DA;
--cog-charcoal: #1C1A17;
--cog-warm-gray: #6B6459;
--cog-muted: #A09689;
--cog-gold: #B8953A;
--cog-gold-light: #D4AE5C;
--cog-gold-pale: #E8D5A0;
--cog-border: rgba(28, 26, 23, 0.10);
--cog-border-gold: rgba(184, 149, 58, 0.40);
```

Every active song screen should preserve the warm radial glow:

```css
radial-gradient(
  ellipse 60% 40% at 50% 85%,
  rgba(184, 149, 58, 0.18) 0%,
  transparent 70%
)
```

## Benchmark Products To Study, But Not Copy

Use current official product pages and docs when network access is available. Benchmark the workflow quality, not the visual design.

Use these as reference classes:

- Songcraft: lyrics, chords, tabs, recordings, and collaboration in one writing environment.
- BandLab: mobile creation, recording, mixing, and collaboration.
- Soundtrap: browser-based collaborative recording studio.
- Ableton Note: instant mobile idea capture, sampling, and sketching.
- GarageBand and Logic Pro for iPad: touch-first Live Loops, real-time musical arrangement, and low-friction recording.
- Tully: lyrics, recordings, secure storage, sharing, contracts, royalties, and artist workflow management.

For every comparison, ask:

- What friction do these apps remove?
- What do they overload that Colors of Glory should avoid?
- What should Colors of Glory beat because of its private song room metaphor?
- What must stay uniquely Christian, worship-team-friendly, calm, and relational?

Do not clone another app. Use them to sharpen the audit standard.

## Required Workflow For Each Feature

### 1. Load The Feature Row

Read the next unaudited row from `MASTER - ALL FEATURES`.

Extract:

- Feature label and sequence number
- Feature name
- Category
- Description
- Implementation plan
- Priority
- Phase
- Dependencies
- Collaboration details
- Testing requirements
- Accessibility notes
- UX risks
- Technical risks

Normalize the feature into a one-paragraph product intent:

`This feature exists so that [user] can [job] in [context] without [friction].`

Then write the core songwriter question:

`If I am writing a worship song and inspiration is fragile, does this feature help me move faster, calmer, and with more confidence?`

### 2. Find The Source Documents

Before auditing implementation, find the feature's source material.

Search:

- `zip_extracted/20. SONGWRITING SPECIFIC PART/`
- `zip_extracted/extracted_text/`
- `docs/`
- `src/`

Prefer extracted text files when available, because many PDFs have already been converted.

Read only the relevant source documents for the feature. Examples:

- Auth/onboarding: onboarding PDFs and `master_onboarding_flow`
- Song catalog: Product Vision 11 and onboarding catalog docs
- Song workspace: Product Vision 02 and 03
- Lyrics/chords: Feature 17 and onboarding lyrics/chords docs
- Voice/audio: Features 09, 10, 11, 16 and related product docs
- Collaboration/roles: Product Vision 06 and 07, onboarding 11 and 12
- Activity: Product Vision 08, onboarding 13
- Versions: Product Vision 09 and Feature 24
- Credits: Product Vision 10 and canvas credits docs
- Canvas: Product 01-14, Feature 04, Feature 05, Feature 07, Feature 18-23, Feature 33
- Monetization/storage/referrals: business model docs and onboarding 15, 16, 18

If no matching source doc exists, state that clearly and derive the audit from the spreadsheet row, project `AGENTS.md`, and current implementation.

### 3. Map The Feature In The App

Find all code paths connected to the feature:

- Routes
- Pages
- Components
- Hooks
- Stores
- Types
- Supabase queries or tables
- Tests
- QA scripts
- Performance budget scripts
- Screenshot or smoke-test artifacts

Use `rg` first. Do not refactor unrelated files. Do not touch user changes unless the feature audit requires it.

### 4. Build A Feature Hypothesis

Before running tests, state what the feature must feel like.

Answer:

- What is the primary action?
- What is the fastest happy path?
- What is the most likely real-world worship-team context?
- What is the one moment that must feel instant?
- What could make a songwriter abandon the flow?
- What data must never be lost?
- What permission boundary must never fail?
- What is the minimum useful offline or poor-network behavior?
- What should happen in the first 100ms after the user acts?

### 5. Run Baseline QA

Use the repo's existing commands first.

Run whatever exists from this list:

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run perf:budget
npm.cmd run qa:codex
```

If a command is missing, note it. Do not invent success.

For a production-feel test, build and preview the app when feasible:

```bash
npm.cmd run build
npm.cmd run preview
```

Use the browser to inspect the built app, not only the dev server, for performance-sensitive conclusions.

### 6. Browser And Device Matrix

Audit the feature at minimum in these viewports:

- Mobile primary: `390 x 844`
- Mobile narrow: `375 x 812`
- Mobile large: `430 x 932`
- Tablet: `768 x 1024`
- Desktop companion: `1440 x 900`

For each viewport, inspect:

- Does anything overlap?
- Does text fit without awkward truncation?
- Are touch targets at least 44px?
- Is the primary action visible and reachable?
- Does the keyboard cover inputs or CTAs?
- Does the bottom nav or safe area collide with content?
- Are cards stable in height?
- Does the warm glow support the screen rather than muddy it?
- Is the UI still calm at high data volume?

Capture screenshots for mobile primary and any failing viewport.

### 7. Instant-Feel Performance Budget

The feature is not done unless it feels instant.

Use these budgets unless the feature has a documented reason to differ:

- First visual feedback after tap/click: under 100ms
- Primary action optimistic UI: under 150ms
- Route transition visible state: under 200ms
- Interaction to Next Paint target: under 200ms
- No individual event handler should block longer than 50ms
- LCP on mobile production build: under 2.5s
- FCP on mobile: under 1.8s
- CLS: under 0.1
- TTFB for server/API-backed route: under 800ms
- Initial mobile route JS should stay as small as possible; heavy editor, canvas, audio, transcription, and analysis code must be lazy-loaded.
- No loading state may be spinner-only where a skeleton or stable optimistic state would be clearer.

For audio features:

- Record button visual acknowledgment: under 100ms
- Recording timer starts visibly: under 250ms
- Playback button response: under 150ms, or shows a clear buffering state
- Waveform rendering must not block recording or playback
- Long waveform analysis must run async or off the main thread
- Metronome scheduling jitter should be measured and kept below perceptible drift
- Layered playback must report and minimize sync drift
- Audio permissions errors must be human and recoverable

For collaboration features:

- Local user action appears immediately.
- Remote sync can follow, but the UI must not feel frozen.
- Conflict states must explain what happened in human language.
- Permission-denied states must be calm, clear, and non-technical.

### 8. Deep UX Stress Test

Perform these tests from the perspective of a songwriter who is trying not to lose an idea:

- One-thumb test: can the primary action be completed with one thumb on a 390px phone?
- Backstage test: can it work while distracted, in dim light, before rehearsal, with low patience?
- First-time collaborator test: can a non-technical church volunteer understand it without training?
- Returning writer test: can an owner reopen a song and immediately understand what changed?
- Fragile idea test: if I have a melody in my head, can I capture before it disappears?
- Trust test: does the UI make it clear the song is private and protected?
- Calm test: does the screen avoid notification anxiety, red badge pressure, and SaaS clutter?
- Worship context test: does the language feel spiritually intentional without being forced or cheesy?
- DAW-avoidance test: does it avoid overwhelming users with producer-grade complexity too early?
- Multi-contributor test: can Sarah, Parker, Caleb, and the owner all understand their role and next step?

Score the feature from 1 to 10 for:

- Songwriter friction
- Capture speed
- Calm clarity
- Collaboration confidence
- Mobile ergonomics
- Faith-context fit
- Data trust

Anything below 8 requires findings and recommended fixes.

### 9. Data, Permissions, And Integrity QA

For every feature, verify:

- Owner, Contributor, Reviewer, and Viewer behavior
- Empty state
- Loading state
- Slow network state
- Offline or reconnect behavior
- Error state
- Undo or recovery path where creative data could be lost
- Activity logging where relevant
- Version history or snapshot behavior where relevant
- Invite token handling where relevant
- Supabase RLS assumptions where relevant
- Storage limits and upgrade gates where relevant
- Privacy of song content, phone numbers, memos, and collaborator data

Creative work must never disappear silently.

### 10. Accessibility QA

Audit:

- Semantic landmarks
- One clear `h1` per route-level screen
- Logical heading order
- Labels for every input
- Screen reader names for icon buttons
- Focus visibility
- Focus order
- Keyboard completion of primary flow
- Escape/back behavior for sheets and modals
- Reduced motion behavior
- Color contrast on cream, gold, muted gray, and selected card states
- Live regions for recording, saving, upload, playback, invite, and error status
- Audio controls operable without sight
- No essential meaning conveyed only by color, waveform animation, or glow

### 11. Performance Instrumentation

Where practical, collect:

- Build output and bundle chunk sizes
- Lighthouse mobile metrics
- Playwright trace or browser timing observations
- Console errors and warnings
- Network request count
- Slow 3G or 4G behavior for routes that load data
- DOM node count before and after the primary action
- Long tasks
- Memory growth after repeated interaction
- React render churn when typing, dragging, recording, or playing audio
- Screenshot evidence

For heavy features, stress test with realistic high-volume data:

- 1 song
- 10 songs
- 50 songs
- 200 songs
- 1 collaborator
- 5 collaborators
- 25 collaborators
- 1 memo
- 20 memos
- 100 memos
- Long lyric sections
- Many chord chips
- Many canvas nodes
- Mixed permission roles

### 12. QA UI Or Internal QA Dashboard

If the project already has a QA dashboard or audit artifact system, update it.

If a development-only QA UI is needed, propose it separately before building. It should:

- Be development-only and impossible to ship publicly.
- Live behind a route such as `/__qa` or as static audit artifacts under `docs/`.
- List every spreadsheet feature row.
- Show audit status: Not Started, Pre-Build Spec, In Progress, Pass, Pass With Warnings, Fail, Blocked.
- Link to the per-feature audit file.
- Link to screenshots.
- Show latest metrics: Lighthouse, route chunk, console errors, primary tap latency, accessibility status, UX score.
- Allow filtering by phase, category, priority, route, and status.
- Never expose secrets, real user data, phone numbers, audio files, or private song content.

Do not build this QA UI unless explicitly asked. For normal audits, create Markdown and JSON artifacts.

### 13. Required Output Per Feature

Create a feature audit file:

`docs/codex-feature-audits/feature-###-feature-slug.md`

Use a three-digit sequence based on audit order, not necessarily the spreadsheet label.

Example for first row:

`docs/codex-feature-audits/feature-001-church-center-phone-login.md`

Each audit must include:

1. Feature identity
2. Spreadsheet source row fields
3. Source docs read
4. Current implementation map
5. Route/component/data map
6. Benchmark references considered
7. Happy path QA
8. Edge case QA
9. Mobile UI QA
10. Accessibility QA
11. Performance evidence
12. Audio/collaboration/data integrity evidence where relevant
13. Findings ordered P0, P1, P2, P3
14. Missing tests
15. Recommended fixes
16. Acceptance gate
17. Verdict: Pass, Pass With Warnings, Fail, Blocked, or Pre-Build Spec
18. Next feature to audit

Also update a compact index if one exists:

`docs/codex-feature-audits/index.json`

If it does not exist, create it only if the user asked for persistent audit tracking.

### 14. Finding Severity

Use this severity scale:

- P0: Data loss, privacy leak, broken primary flow, unusable mobile UI, auth/security failure, feature cannot be meaningfully used.
- P1: Major friction, serious accessibility failure, poor performance, confusing permission behavior, broken collaboration trust.
- P2: Polish issue, warning noise, incomplete empty/error state, unclear copy, weak responsive behavior.
- P3: Nice-to-have improvement, minor copy polish, small animation refinement.

Lead with findings. Do not bury issues under praise.

### 15. Feature 1 Starting Checklist

For Feature 1, `Church Center-Style Phone Number Login UX`, specifically audit:

- Phone number entry feels simple, safe, and familiar.
- No password setup appears in the main flow.
- Country code and international formatting are understandable.
- SMS code entry is keyboard-friendly and screen-reader-friendly.
- Wrong code, expired code, resend, rate limit, poor network, and carrier delay states are human and calm.
- Invited guest collaborators enter the exact intended song after verification.
- Session start, device info, and failed attempts are logged without exposing sensitive information.
- Phone number privacy is explained without creating anxiety.
- The flow works at 390px with keyboard open.
- The CTA remains visible and tappable.
- The user gets feedback within 100ms after submit.
- The app does not show generic Supabase/Firebase/technical errors.
- The login design feels like a spiritual creative tool, not a banking app and not a startup signup funnel.

Acceptance gate for Feature 1:

- A worship leader can enter phone number, receive code, verify, and land in either song catalog or invited song room with no confusing account creation moment.
- All auth errors are recoverable.
- The primary flow passes mobile, keyboard, accessibility, and slow-network QA.
- No old fly4me code, copy, routes, or assets appear.

## Final Instruction

Audit one feature at a time. Finish the current feature's artifact before moving on. Be exact, evidence-led, and unsentimental. The standard is not "works on my machine." The standard is: a world-class songwriter can open Colors of Glory on a phone, capture or shape a worship song instantly, collaborate without anxiety, and trust that the song room protects the creative work.

If the feature does not meet that standard, say so clearly and prescribe the smallest high-leverage fixes.

## Benchmark Source Links

- [Songcraft](https://songcraft.io/)
- [BandLab](https://www.bandlab.com/?lang=en)
- [Soundtrap for Education](https://schools.soundtrap.com/edu/)
- [Ableton Note on the App Store](https://apps.apple.com/us/app/ableton-note/id1633243177)
- [GarageBand Live Loops overview](https://support.apple.com/guide/garageband-iphone/live-loops-overview-chsca7ff9ced/ios)
- [Logic Pro for iPad Live Loops](https://support.apple.com/guide/logicpro-ipad/intro-to-live-loops-lpip052333b6/ipados)
- [Tully](https://tullyapp.com/)
