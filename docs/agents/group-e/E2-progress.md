# E2 · Activity Feed Agent — Progress

## 2026-07-07 — Steps 1–10 landed in one pass (launch-ready pending live-auth spot-check)

### What changed
- **Step 1 — route:** `src/routes/songRoutes.tsx` now renders
  `<RequireAuth><ActivityPage /></RequireAuth>` at `/songs/:id/activity`
  (was `CanvasLayerRedirect layer="room"`). Lazy-loaded like its neighbors.
  (App.tsx delegates to this route module since A5's refactor — one file, one line.)
- **Steps 2–3 — real feed + copy map:** `src/pages/ActivityPage.tsx` fully
  de-mocked (hardcoded `ACTIVITY` array, mojibake `Â·`/`â†’`, wrong
  `SongTabBar activeTab="people"`, and the content-rule-violating
  "Changed line 3: Grace in the storm…" are all gone). New
  `src/components/activity/`:
  - `activityCopy.ts` — compiler-checked exhaustive 16-kind → calm-copy map
    (sentence/sub/icon/surface), fallbacks for unknown kind + unknown actor,
    `activityHref` deep-link resolver. Sentences take actor+count ONLY — the
    content rule is enforced by construction.
  - `ActivityCard.tsx` — the download-(20) card (cream, actor-color left
    border, avatar initials, relative time) rendered purely from the group VM.
  - `RecapBanner.tsx` — the gold "The gist" paragraph.
  - `useActivityFeed.ts` — the hook (below).
- **Step 4 — since-you-left:** read-then-mark via `getNotificationPrefs` →
  `markSongSeen`; baseline pinned per visit; re-mark on unmount; read-failure
  still marks (next visit gets a delta). First visit = single "Recent activity"
  section, no fake delta.
- **Step 5 — grouping:** since-section from the server digest
  (`listActivitySince`, `event_count` authoritative); "Earlier" folded
  client-side (same actor+kind within 60 min, exported `groupRows`).
  Digest RPC failure degrades to the same client grouping — never a firehose.
- **Step 6 — recap:** `getRecapDigest` requested only when baseline exists and
  delta ≥ 3; errors → `null` silently; never blocks cards.
- **Step 7 — realtime:** `subscribeSongRoom({ onActivity })` → quiet
  react-query invalidation (rows + digest); unsubscribes on unmount; no badges.
- **Step 8 — links + gating:** every card navigates via `activityHref`
  (voice/people/canvas/room). Owner-only "N ideas are waiting for your review"
  rollup gates on `getSong().my_role === "owner"` and links to the canvas —
  E2 never restores or reviews. **E1's `useCapabilities` does not exist yet**
  (E1 never ran; no docs/ROLE-CONTRACT.md) — the gate is one expression,
  ready to swap. Filed in docs/ACTIVITY-CONTRACT.md §6–7.
- **Step 9 — states + a11y:** warm empty state, calm skeleton (role=status),
  quiet error state, `aria-live="polite"` on the since-list,
  `prefers-reduced-motion` disables entrances (framer `useReducedMotion`),
  color always paired with initials, cards are real buttons with descriptive
  aria-labels.
- **Step 10 — contract:** published `docs/ACTIVITY-CONTRACT.md` (kind→copy
  table, data shapes, since-you-left semantics, calm rules, D3 adoption note).

### What I verified (not assumed)
- **Real browser (puppeteer-core + installed Chrome, 390×844, Vite dev on
  :8080):** anon `/songs/demo-song/activity` → `/auth/login` (NOT
  `/canvas?layer=room`), `cog:return-to` preserved = the route mounts the
  guarded ActivityPage. Screenshot: scratchpad `activity-0-anon-guard.png`.
  Full authed drive is blocked: email signup requires inbox confirmation,
  the native phone provider is disabled (`phone_provider_disabled`), and no
  test credentials exist in the repo. **Recommend a human 2-minute spot-check
  with a real account** (visit → make a change elsewhere → revisit).
- **jsdom integration (11 tests, `src/test/activity-feed.test.tsx`, all
  passing):** real page + real hook over realistic seam mocks — grouped
  digest card ("Sarah M added 2 voice memos"), real headline count,
  since/earlier split, **payload text never renders** (seeded
  "Grace in the storm" asserted absent), read-BEFORE-mark call order asserted,
  `listActivitySince` called with the PRIOR timestamp, viewer sees no review
  rollup, warm empty state, realtime subscribe + unmount re-mark, no
  `bg-red`/`text-red` classes anywhere.
- `tsc --noEmit` clean; `npm run build` green (ActivityPage code-splits).
- `design-guard` no longer flags E2 (neutral actor color is now
  `var(--cog-muted)`; hex-tint only applied to real DB hex colors).

### Pre-existing failures NOT mine (parallel sessions live during this run)
- `design-guard`: `components/ui/glow.tsx: #B8953A` (A1's lane; glow.tsx.bak
  sits next to it).
- `sheet-doc`, `seo`, `codex-mobile-render`, `feature04-canvas` failures —
  none reference ActivityPage/songRoutes/components/activity; they belong to
  the C3/canvas/routing work happening concurrently (E3 + E4 landed routes
  mid-run; songs.ts moved under me twice).

### What D3 now depends on
`docs/ACTIVITY-CONTRACT.md` — the shared kind→copy map
(`@/components/activity/activityCopy`), digest shape, and since-you-left
semantics. D3 should delete `DEMO_ITEMS` and consume these.

### Filed with other lanes
- A3: declare `last_seen_at` on `SongNotificationPrefs` (read today via cast);
  optional `getSongSeen` reader.
- E1: `useCapabilities` — swap point marked in ActivityPage.
- Housekeeping: `puppeteer-core` added as a devDependency for the browser
  verification harness (scratchpad script `verify-activity.cjs`).
