# A3 Data Access — Progress Log

> Note: this file is created at Step 3. No prior on-disk A3 log existed (the
> orchestrator's Step 1–2 were census/shape work already reflected in the tree).
> The repo is under CONTINUOUS parallel commit + merge by the orchestrator —
> HEAD advances mid-task and edits are swept into commits. ALWAYS re-read a file
> from disk immediately before editing; the Read tool cache can lag the tree.

## Step 3/10 — Make CogError universal (2026-07-08)

**Goal:** one error taxonomy for the whole seam. Every `cog/*` fn returns data
or throws a `CogError` with a stable `.code` the UI switches on — no raw
PostgREST / RPC / storage / edge-function string ever escapes.

**Changed — new file `src/integrations/cog/errors.ts`** (the promoted contract):
- `CogErrorCode` union + `CogError` class (moved out of `songs.ts`).
- `toCogError(err)` — normalizes a direct `.from()/.rpc()/.storage` error:
  passthrough existing CogError → message-token scan (an RPC that RAISEd a
  semantic code as its message, e.g. `QUOTA_EXCEEDED_STORAGE`/`INVITE_EXPIRED`,
  is recovered) → SQLSTATE map (`42501`→FORBIDDEN, `PGRST301/302`→UNAUTHENTICATED)
  → message-shape fallbacks (RLS/JWT) → `INTERNAL`.
- `codeFromServer(raw, message?)` — maps an edge function's envelope `code` or
  legacy `{ error:"<slug>" }` body to a code. Canonical UPPER codes pass through;
  a slug table maps `song_limit_reached`→QUOTA_EXCEEDED_SONGS,
  `storage_limit_reached`→QUOTA_EXCEEDED_STORAGE, `forbidden`→FORBIDDEN, invite
  slugs, etc.; an unknown slug is preserved verbatim on `.code` AND kept on
  `.message` so existing message-matching callers keep working.
- `call<T>(fn, body?)` — edge wrapper, hardened: on a non-2xx it reads the JSON
  body off `error.context` and handles BOTH the `{ ok, code, message, data }`
  envelope AND a legacy `{ error:"<slug>" }` body, running the code through
  `codeFromServer`. This is what makes QUOTA/INVITE codes survive end-to-end.

**Modules normalized (16 + songs/members/notes wired):**
- `songs.ts` — inline contract removed; imports + re-exports from `./errors`
  (so `members/notes/versions` `import { CogError } from "./songs"` still
  resolve); 6 direct throws → `toCogError`.
- `members.ts`, `notes.ts` — import from `./errors`; direct throws → `toCogError`
  (notes keeps `CogError` for INVALID_INPUT/UNAUTHENTICATED).
- Charter 13: `capture` (promoteCapture→`call`, +4 reads), `canvas`
  (commitTakeToCanvas→`call`, +4), `memos` (createUploadUrl/finalize/
  getPlaybackUrl/retryTranscription→`call`, +4 reads, PUT→CogError),
  `takes` (auth→CogError, +7), `transcript` (requestTranscript→`call`, +2),
  `activity` (getRecapDigest→`call`, +2), `billing` (14 reads + 6 `new Error`),
  `storage` (auth→CogError; reads stay fail-soft), `founders` (4), `referrals`
  (9; `resolveCode`/`setMyPayoutMethod` keep their `{ ok }` payloads — NOT
  routed through `call`), `scripture` (1 + no-passage), `intake` (1 + no-data).
  `memory.ts` needed no change — it is fully fail-soft (only throws via the
  now-normalized `listMySongs`).
- Beyond the charter's 13 but REQUIRED by "no raw PostgREST error escapes the
  seam": `admin.ts` (20 + 2), `brainstorm.ts` (5), `sheet.ts` (auth + 9). These
  are seam modules that were leaking raw errors; the orchestrator census missed
  them. `versions.ts` already wraps everything via its own `asCogError`→CogError
  and was left untouched.

**AUTH BOUNDARY DECISION (recorded in `errors.ts` header):** `cog/auth.ts` keeps
its OWN `AuthError` / `AuthErrorCode` taxonomy — NOT folded into `CogError`. Auth
runs before a session exists and maps provider-specific failure modes (OTP
expired, phone-provider-disabled, geo-block, SMS cooldown/ceiling, rate-limit +
`retryAfterSeconds`) to curated recovery copy — disjoint from the data plane's
FORBIDDEN/QUOTA_*/INVITE_* codes. `AuthError` already never leaks a raw string,
so it meets the same "typed, coded, no-raw-message" guarantee on its own
boundary. Two focused unions beat one leaky god-enum. `auth.ts` was NOT edited.

**Verified (concrete, on the current advanced HEAD):**
- `grep` for raw `throw error;` / `throw new Error(` / named `throw *Res.error`
  across `src/integrations/cog/` (excluding auth's AuthError) → **NONE**.
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors in `src/integrations/cog/`**
  (whole-tree count is red from unrelated in-flight A2/A4/A5 modules —
  `@/types`, `@/lib/queryClient`, `@/lib/motion`, etc. — none touched by me; I
  changed **zero exported signatures**, so I introduced no new errors).
- New suite `src/test/cog-errors.test.ts` → **16/16 pass**, asserting `.code`
  for FORBIDDEN (SQLSTATE 42501 + RLS message + envelope) and
  QUOTA_EXCEEDED_STORAGE (RAISEd RPC message + `storage_limit_reached` slug +
  end-to-end through `call`), plus QUOTA_EXCEEDED_SONGS, success-payload unwrap.
- Regression: `start-first-song` 3/3 and `global-capture-routing` 18/18 (they
  exercise `songs.createSong` + capture) pass. The 22 full-suite failures are
  all pre-existing/parallel: missing test providers (No QueryClient /
  PracticePlayerProvider), `App.tsx` route-source assertions (A5), an `auth.ts`
  phone-OTP classify mismatch, and canvas/SEO render tests — none reference the
  error contract.

**Dependencies for other agents:**
- Feature/UI agents: catch a `CogError` and switch on `err.code` — NEVER parse
  `err.message`. Quota codes drive MOMENTS: `QUOTA_EXCEEDED_SONGS`→/upgrade,
  `QUOTA_EXCEEDED_STORAGE`→storage screen (not a toast). `ReviewSheet.tsx` still
  message-matches slugs (`song_limit_reached`/`forbidden`/`take_not_found`) —
  that keeps working because `call` preserves the slug on `.message`, but it
  should migrate to `.code`.
- A2: when the `@/types` barrel ships, `CogErrorCode` (and the separate
  `AuthErrorCode`) should re-export from there; `errors.ts` is the source today.
- A4: `call`'s success/failure shape is the contract a `useMutation` layer wraps;
  reads that fail soft (storage/memory) intentionally return data, not throw.

## Step 4/10 — Get Supabase out of the UI (2026-07-08)

**Goal:** no page or feature component touches the Supabase client directly.
Every rogue `supabase.*` in `src/pages` / `src/components` routes through a
typed seam fn/hook (the DATA line only — no JSX/copy changed).

**New seam fns (in-lane `cog/*` + one shim):**
- `cog/founders.ts` → `claimFounderCodeRedemption(codeId)` — wraps the
  `claim_founder_code_redemption` RPC, returns `boolean`, throws `CogError`.
- `cog/admin.ts` → `adminListFounderCodes()` + `AdminFounderCodeRow` — one
  `.from("codes")` reader (kind=founder, newest-first) backing BOTH admin
  Founders + Codes tables.
- `cog/songs.ts` → `setFirstSong(songId)` — the profile `first_song_id` pointer
  write (resolves the user itself; no-ops signed out; `toCogError`).
- `cog/memos.ts` — extended `createUploadUrl` (added optional `parentMemoId` /
  `idempotencyKey` / `fileName` to the body), added `getSignedPlaybackUrl`
  (tolerates the edge's `signed_url` field — the player pipeline's shape),
  `transcribeMemo`, `listMemoRowsWithSection` (+ `VoiceMemoWithSection`), and
  switched `deleteMemo` to the `voice-memo-delete` edge (was a row-only delete
  that orphaned storage — no external caller relied on the old form; now
  matches `songs.deleteVoiceMemo`).

**Rogue calls evicted (DATA line only; look/behave identical):**
- `pages/onboarding/StartFirstSongPage.tsx` — `supabase.auth.getUser()` →
  `getSessionUser()`; raw `profiles.update({first_song_id})` → `setFirstSong()`.
- `pages/onboarding/FounderCodePage.tsx` — raw
  `supabase.rpc("claim_founder_code_redemption")` → `claimFounderCodeRedemption()`
  (kept the exact "couldn't be redeemed" copy via a local try/catch).
- `pages/admin/FoundersPage.tsx` + `pages/admin/CodesPage.tsx` — inline
  `.from("codes")` queryFns → `adminListFounderCodes` (CodesPage now reuses
  `AdminFounderCodeRow`).
- `lib/voice/voiceApi.ts` — the THIRD uploader's Supabase bypass is gone: it is
  now a pure shim over `cog/memos` (delegates upload-url/finalize/signed-url/
  delete/transcribe/list, keeps its display `VoiceMemoRecord` mapping). No
  `supabase.*` left in `src/lib/voice`.
- Also cleaned (same auth-read class as RequireAuth/LatestPeek, converted so the
  gate grep is fully clean): `pages/pricing/UpgradePage.tsx` (2× getUser →
  `getSessionUser`), `pages/VoiceMemosPage.tsx` (getUser → `getSessionUser`),
  `pages/auth/ResetPasswordPage.tsx` (its own `onAuthStateChange`+`getSession`
  recovery listener → consumes A4's `useAuth()` status; behavior preserved —
  AuthProvider wraps the route per App.tsx). Reworded a stale `supabase.from`
  mention in a `CapturePage.tsx` comment.

**Verified (concrete):**
- `npx tsc -p tsconfig.app.json --noEmit` → **clean** (0 output).
- `grep -rn "supabase\." src/pages src/components` → **NONE**. Repo-wide,
  `supabase.` now lives ONLY in `src/integrations/*` (22), `src/hooks` (2),
  `src/lib/auth` (2), `src/lib/invite` (1 inviteApi), `src/lib/pricing` (1
  pricingApi) — `src/lib/voice` dropped off entirely.
- Tests: `start-first-song` (3/3, added `setFirstSong` to its cog/songs mock),
  `founder-code` (2/2) + `cog-founder-code-page` (4/4) pass UNMODIFIED (they
  mock the supabase client used by the new `cog/founders` wrapper), plus
  `captureOutbox`/`pendingUploads`/`captureUploaders`/`seedIdeaApi`/
  `voice-memo-added` — **43/43** across the 8 files. `cog-errors` still green.
  The 4 `codex-mobile-render` failures are pre-existing missing-provider issues
  (`usePracticeContext must be used inside <PracticePlayerProvider>`) + canvas
  render — untouched pages (upgrade/settings/workspace/capture) render fine.

**Dependencies / notes for others:**
- Feature agents: import voice ops from `cog/memos` OR the `lib/voice/voiceApi`
  shim — both are now one pipeline; `voiceApi` no longer opens its own client.
- `inviteApi`/`pricingApi` (`src/lib`) still hold `supabase.*` — pre-existing lib
  seams, not in Step-1's rogue list; out of this step's page/component gate.
- The full "3 uploaders → 1" semantic merge is progressed (voiceApi bypass
  removed) but `cog/memos.uploadVoiceMemo` (brainstorm) and the voiceApi shim
  remain two entry points sharing the same seam primitives — final single-entry
  unification is its own step.

## Step 5/10 — Canonical query-key factory `qk` (2026-07-08)

**Goal:** one shared key vocabulary every query/mutation hook builds from — no
hook hand-rolls an inline string array. This is the vocabulary A4's invalidation
policy references.

**New file `src/hooks/queryKeys.ts`** — the canonical `qk` factory (+ `QueryKey`
type). Surface:
- Song room: `songs()`, `song(id)`, `songDetail(id)`, `songMembers(id)`,
  `memos(songId)`, `canvas(id)`, `captures(songId)`, `notes(songId)`,
  `activity(id)`, `activityDigest(id)` (leaf under activity), `unfiledCaptures()`.
- Account: `billing()`, `storage()`, `subscription(userId)`, `authUser()`,
  `onboarding(userId)`.
- `members(id)` — kept as an alias of `songMembers` because A4's
  `invalidation.ts` references `qk.members`; same shape, prefer `songMembers`.
- `admin.*` namespace: `root()`, `founderSummary()`, `allFounderCodes()`,
  `allCodesFull()`, `recent(limit)`, `founder(id)`, `financeSummary()`,
  `attention()`, `otpStats()`, `audit(filters, offset)`, `referrerLedger()`,
  `payouts(month)`, `payoutBatches()`, `billingEvents(onlyFailed?)`,
  `fraudFlags(onlyOpen?)`. The two filtered ones return the bare prefix when
  called with no arg — that IS the invalidation key (TanStack prefix match).

Shape law: `[domain, id?, sub?]`; invalidating a less-specific key invalidates
every more-specific key under it. `song(id)` invalidates the whole song;
`activity(id)` also clears `activityDigest(id)`; `admin.root()` clears the console.

**A4 seam reconciled — no A4 files edited.** A4 had stubbed `qk` at
`src/lib/cache/queryKeys.ts` with a comment inviting A3's factory to replace it.
I rewrote that file to a pure re-export of `@/hooks/queryKeys`, so
`invalidation.ts`, `optimistic.ts`, and `client-state.test.tsx` (all import
`@/lib/cache/queryKeys`) resolve to the single source unchanged. Both import
paths now point at one `qk`.

**Migrated to `qk` (my lane + task-sanctioned admin):**
- `src/hooks/useSubscription.ts` — `["auth-user"]`→`qk.authUser()`,
  `["subscription", userId]`→`qk.subscription(userId)` (identical shapes).
- `src/hooks/useSongNotes.ts` — `["auth-user"]`→`qk.authUser()`; the exported
  `songNotesKey` helper now delegates to `qk.notes(songId)` (shape moved from
  `["song-notes", id]` to `["song", id, "notes"]` — internally consistent: the
  same helper backs both the read and every invalidate, and no test/consumer
  asserts the literal).
- Admin (all 13 sites): `WebhookOpsPage`, `ReferralsPage`, `PayoutsPage`,
  `PayoutBatchesPage`, `FraudPage`, `FoundersPage`, `FounderDetailPage`,
  `FinancePage`, `CodesPage`, `AuthSecurityPage`, `AuditLogPage`,
  `AdminHomePage`, `components/admin/CreateFounderDialog`,
  `components/admin/CreateCodeDialog`. Every inline `["admin", …]` read key and
  every `invalidateQueries({queryKey:["admin", …]})` now uses `qk.admin.*`.

**Verified (concrete):**
- `npx tsc -p tsconfig.app.json --noEmit` → **clean, 0 errors**.
- `npx vitest run src/test/client-state.test.tsx` → **7/7 pass** (proves A4's
  invalidation policy + optimistic helper still resolve `qk` through the shim).
- `grep queryKey:\s*\[\s*["']` → **0 hits in my lane** (src/hooks/**) and **0 in
  admin**. Remaining hits (12) are ALL in other agents' lanes — see flag below.

**Flag — divergent key shapes outside my lane (correctness risk for A4):**
Twelve inline string keys remain, each in a parallel agent's file with its OWN
key helper, so I did not touch them:
- `["song-detail", songId]` in `pages/SongWorkspacePage.tsx` and
  `components/activity/useActivityFeed.ts` — **different shape** from
  `qk.songDetail` (`["song", id, "detail"]`). A4's `invalidationMap.commitTake` /
  `editRoom` invalidate `qk.songDetail`, which will NOT match `["song-detail",…]`.
  These reads won't refresh on a commit until they migrate to `qk.songDetail`.
- `["song-members", songId]` in `NotesPage`, `useSongVersions`, `useActivityFeed`
  vs `qk.songMembers` (`["song", id, "members"]`) — same divergence.
- `["onboarding", user?.id]` in `lib/onboarding/onboardingStep.ts` — shape
  MATCHES `qk.onboarding`; trivially migratable when that lane touches it.
- Own-namespace keys with no qk equivalent yet: `["memory"]` (MemoryPage,
  SongMemoryPage), `["song-sheet", id]` (useSongSheet), `["canvas-recap", …]`
  (useCanvasRecap), `["song-version-role", id]` (useSongVersions),
  `["activity-digest", id]` (useActivityFeed — note `qk.activityDigest` exists but
  with shape `["song", id, "activity", "digest"]`).

**Dependencies for other agents:**
- A4: `qk` is now the canonical import (`@/hooks/queryKeys`); `@/lib/cache/queryKeys`
  is a thin re-export. Your invalidation map is unchanged and green. ACTION: the
  `["song-detail"]` / `["song-members"]` feature-hook keys don't match your
  `qk.songDetail` / `qk.songMembers` — commit/edit invalidations silently miss the
  workspace + activity + notes reads. Either the feature hooks migrate to `qk`
  (preferred) or the policy must invalidate both shapes.
- E2 (activity), E3 (versions), C5/notes page, F33 (memory), D (canvas recap),
  sheet: your query hooks hold bespoke inline keys/helpers — migrate them to `qk`
  (`activity`, `activityDigest`, `songMembers`, `songDetail`, plus add `memory`/
  `sheet`/`canvasRecap` builders to `queryKeys.ts` if you want them centralized).
- A5: no routing impact.

## Step 6/10 — Main-app reads on TanStack Query (2026-07-08)

**Goal:** put the primary app's reads behind one typed, cache-aware query layer —
no screen fetches imperatively (`await cog fn` + `setState`) anymore. Loading /
error typed as `CogError`; reads FAIL SOFT (stale + gentle retry, never a
blocking modal); every key built from the shared `qk` factory (Step 5).

**New file `src/hooks/useAppQueries.ts`** — the canonical read-hook layer. Ten
hooks, each keyed off `qk`, fetched through a `cog/*` seam fn (so `error` is a
normalized `CogError`), with a deliberate `staleTime` sized to volatility:
- `useSongs()` → `qk.songs()` / `listMySongs` — staleTime **60s** (catalog longer).
- `useSongDetail(id)` → `qk.songDetail(id)` / `getSong` — **10s** (counts drive
  the hub badges → short). Resolves `null` for non-members (calm, not a throw).
- `useSongMembers(id)` → `qk.songMembers(id)` / `listMembers` — **60s** (roster).
- `useMemos(id)` → `qk.memos(id)` / `listMemosForSong` — **30s**.
- `useCanvasCards(id)` → `qk.canvas(id)` / `listCanvasCards` — **30s**.
- `useCaptures(id)` → `qk.captures(id)` / `listCaptures` — **30s**.
- `useUnfiledCaptures()` → `qk.unfiledCaptures()` / `listMyUnfiledCaptures` — **30s**.
- `useActivityDigest(id, since)` → `[...qk.activityDigest(id), since]` /
  `listActivitySince` — **10s** (most volatile); keyed by songId **and**
  `last_seen_at`, gated on `since !== null`.
- `useBillingStatus()` → `qk.billing()` / `getMyBillingStatus` — **60s**.
- `useStorageUsage()` → `qk.storage()` / `getStorageUsage` — **30s**.
The client default (`@/lib/queryClient`: staleTime 5m, `retry: 1`) supplies the
single gentle re-attempt; these hooks only override staleness.

**Screens migrated (imperative fetch → hook; DATA line only, zero UI/copy change):**
- `pages/SongWorkspacePage.tsx` (workspace hub) — inline
  `useQuery(["song-detail", id], getSong)` → `useSongDetail(id)`. This ALSO
  retires the Step-5-flagged divergent `["song-detail"]` key onto `qk.songDetail`
  (so A4's `commitTake`/`editRoom` invalidations now reach the hub). Dropped the
  `useQuery` + `getSong` imports.
- `pages/SongCatalogPage.tsx` (catalog) — deleted the imperative
  `useEffect(listMySongs → setSongs)` AND the module-level `songsWarmCache`
  global. `useSongs()` now owns the fetch + cache (Query's cache is the warm
  store → same 0ms warm repaint). Local `songs` state is retained as a working
  copy (seeded synchronously from `songsQuery.data` → no empty flash) that the
  page still mutates optimistically for archive / restore / album edits; an
  effect re-syncs it from the query. Fail-soft toast only when the FIRST load
  errors with nothing cached. Create/archive/unarchive stay imperative (writes,
  out of scope).
- `pages/onboarding/VoiceMemoAddedPage.tsx` (memo panel) — imperative
  `listMemosForSong().then(setMemo)` → `useMemos(id)`; latest memo =
  `data?.[0]`. The `first_voice_memo_added` step-mark side-effect now fires from
  an effect keyed on `memo?.id`. Fails soft to the "capture the first idea"
  prompt on error.
- `pages/settings/StoragePage.tsx` — imperative `getStorageUsage()` +
  3 useState + cancel flag → `useStorageUsage()`; `state` derived
  (`isLoading→"loading"`, `isError→"unavailable"`, else `"ready"`).

**Tests (harness updates only — assertions unchanged):**
- `voice-memo-added.test.tsx`, `song-catalog-hero.test.tsx` — wrapped the render
  in a `QueryClientProvider` (the pages now read through Query; the existing
  `listMemosForSong` / `listMySongs` mocks still drive the hooks). Catalog-hero
  also stubs `PracticeResumeCard` (a PracticePlayerProvider-dependent sibling —
  a PRE-EXISTING red the catalog test hit before my change; stubbed per the
  file's own "stub heavy sub-trees" design so the suite is green, not half-fixed).

**Verified (concrete, on current HEAD):**
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**.
- `npx vite build` → **built in 7.3s, exit 0** (app bundles; only the standard
  >500 kB chunk-size advisory).
- `voice-memo-added` **3/3**, `song-catalog-hero` **4/4**, `client-state` (A4)
  **7/7**, `cog-errors`/`captureOutbox` green.
- `song-workspace-hub` **5/7** — the 2 reds (`navigates…Notes` expects
  `/canvas?layer=notes` vs shipped `/songs/:id/notes`; `RequireAuth` reads
  App.tsx) are PRE-EXISTING: proven identical with my page change `git stash`ed.
- `codex-mobile-render`: my change is behavior-NEUTRAL — identical 5-pass/4-fail
  set stashed vs applied. My two migrations there PASS ("renders the song
  workspace", "renders the guided capture and saved memo states"); the 4 reds
  (catalog PracticeResumeCard, chords, whiteboard, phone-verify) all pre-exist.

**Not migrated (deliberate — preserve behavior, no UI refactor):**
- `components/canvas/SongCanvasExperience.tsx` loads via its own
  `lib/canvas/canvasLoader` + `subscribeSongRoom` (Group D lane). `useCanvasCards`
  is BUILT and ready for D to adopt; I did not refactor that ~1k-line component.
- `pages/VoiceMemosPage.tsx` reads via the `lib/voice/voiceApi` display shape
  (`VoiceMemoRecord`) and is deeply entangled with the capture-outbox
  reconciliation (`setMemos` on `subscribeOutbox`). Forcing it onto `useMemos`
  (raw `VoiceMemo` rows) would change the shape + fight the outbox — out of scope.

**Dependencies for other agents:**
- A4: `useSongDetail` now lands on `qk.songDetail` — your `commitTake`/`editRoom`
  invalidations reach the workspace hub. `useActivityDigest`'s key is
  `[...qk.activityDigest(id), since]`; invalidating `qk.activity(id)` (or broader)
  clears it via prefix match.
- D (canvas): adopt `useCanvasCards(id)` when you migrate the canvas loader off
  imperative fetches — it's keyed `qk.canvas(id)` and typed `CogError`.
- C2 (capture): `useCaptures(id)` + `useUnfiledCaptures()` are the query faces of
  the capture inbox reads.
- E2 (activity): `useActivityDigest` supersedes the bespoke `["activity-digest",
  id]` key in `useActivityFeed.ts`; migrate to share the cache entry.
- Feature/UI agents: consume `.data`/`.isLoading`/`.isError`; `error` is a
  `CogError` — switch on `.code`, never render `.message`. These hooks READ; a
  realtime sub INVALIDATES them, it never streams content in.

## Step 7/10 — Every write behind a typed mutation hook (2026-07-08)

**Goal:** put the primary app's writes behind one typed, cache-aware mutation
layer — the write-side mirror of Step 6. Each hook runs a `cog/*` seam fn
(error = normalized `CogError`), invalidates the RIGHT keys, and wires the
UX-critical writes optimistically so they feel instant.

**New file `src/hooks/useMutations.ts`** — the mutation-hook layer:
- `useCreateSong({ upgradeTo?, onCreated? })` — `QUOTA_EXCEEDED_SONGS` is a
  MOMENT not a toast: `onError` navigates to `/upgrade?source=song_gate` (target
  overridable). Success invalidates catalog + billing and fires `onCreated`.
- `useQuickCapture()` — OPTIMISTIC prepend into `qk.captures(songId)` (or
  `qk.unfiledCaptures()` when unscoped); `onSettled` invalidates captures +
  song-detail counts + `qk.songs()` (a scoped capture bumps `last_activity_at`,
  which reorders the catalog). Rolls back on error.
- `useCommitTake()` — IDEMPOTENT (the `commit-take` edge dedupes by take).
  Invalidates the committed song's room (canvas + activity + detail + memos +
  catalog). NO full board refetch: the live whiteboard reads via realtime
  (`subscribeSongRoom`), not this query, so the invalidations only nudge
  cache-backed observers; the new cards arrive over the channel.
- `useMoveCard(songId)` / `useBulkMoveCards(songId)` — OPTIMISTIC to the bone:
  positions written into the cached board immediately, cheap `canvas_move_card` /
  `canvas_bulk_move` upsert in the background, and DELIBERATELY no success
  invalidation (the optimistic position IS the truth — that's what keeps a drag
  from reloading the board). Only a FAILED move rolls back + resyncs.
- `useInviteMember()` — `createInvite`; invalidates `qk.activity` only (no member
  added yet). `useAcceptInvite()` — `acceptInvite`; the `CogError.code`
  (`INVITE_EXPIRED` / `INVITE_NOT_FOUND` / `INVITE_ALREADY_USED` /
  `INVITE_EXHAUSTED` / `FORBIDDEN` / `UNAUTHENTICATED`) is what drives which
  screen renders. Success invalidates `qk.songs()` + the new room.

**New file `src/hooks/useMemoSave.ts`** — THE single durable memo-save hook.
Wraps `saveMemoDurable` → `enqueueCaptureUpload` (Capture Outbox) → one uploader
→ the ONE upload core. Resolves at ENQUEUE (instant + durable + optimistic card
with real peaks). A dropped upload or `QUOTA_EXCEEDED_STORAGE` does NOT lose the
take — the outbox RETAINS + auto-retries ("Saved · will sync"). Adds a
best-effort cache bridge: on the outbox `success` event it invalidates
`qk.memos` / `qk.songDetail` / `qk.songs` for the synced song so the real memo
replaces the queued card.

**Invalidation source (reconciled vs the task brief):** the task expected A4's
policy to be missing and said to inline the `qk` set + TODO-to-swap. A4's policy
SHIPPED (`@/lib/cache/invalidation` → `invalidationMap` + `invalidateFor`, green
under `client-state.test`), so these hooks CONSUME it directly — one source of
truth for both read and write. Two deliberate augmentations at the call site
(NOT edits to A4's file): `quickCapture` adds `qk.songs()` (catalog ordering),
`commitTake` adds `qk.songs()` (new-song path).

**Three uploaders → one (the collapse, verifiable):**
- `cog/memos.uploadVoiceMemo` is now THE single upload core (extended to accept
  `parentMemoId` / `idempotencyKey` / `fileName`; does the one
  createUploadUrl→PUT→finalize).
- `lib/voice/voiceApi.uploadVoiceMemo` now DELEGATES to that core instead of
  re-implementing the three steps. Its now-orphaned step helpers
  (`getUploadUrl` / `uploadBlob` / `finalizeMemo` — a SECOND `fetch` PUT — and
  the `UploadUrlResult` type) were DELETED (verified zero importers outside the
  file). Result: **exactly one `method:"PUT"` in the whole tree**
  (`cog/memos.ts:290`).
- The outbox default (`voiceApi`) uploader → voiceApi → core; the brainstorm
  (`memos`) uploader → core; the in-song capture (`intake`) uploader → the
  intake edge. Every take still routes through `enqueueCaptureUpload`.

**Verified (concrete, on current HEAD):**
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**.
- `npx vite build` → **built in 6.8s, exit 0**.
- New suite `src/test/use-mutations.test.tsx` → **8/8** (createSong success
  invalidates catalog+billing / quota→`/upgrade` not a toast; quickCapture
  optimistic prepend; commitTake invalidates canvas+activity; moveCard optimistic
  + NO success invalidation, rollback+resync on failure; acceptInvite surfaces
  `.code`; memoSave routes through `saveMemoDurable`).
- Collapse regression: `captureOutbox` 11, `pendingUploads` 9, `seedIdeaApi` 9,
  `captureUploaders` 2, `failedCaptureStore` 4, `CaptureScene`(+lifecycle) 5,
  `ReviewSheet` 2, `voice-memo-added` 3 → all green. `client-state`(A4) 7 +
  `cog-errors` 16 still green.
- `grep 'method:"PUT"'` across `src` → **1 hit** (the single core).

**Wiring status (honest):** the hooks are the canonical write LAYER (like Step
5's `qk` and Step 6's read hooks). The heavy owning components were NOT
force-refactored onto them this step (behavior-preservation + their agents' lane):
`ReviewSheet` still calls `commitTakeToCanvas` + its own `/upgrade` nav (adopt
`useCommitTake`); `SongCanvasExperience` (D) still calls `moveCard`/`bulkMoveCards`
with its own optimistic state (adopt `useMoveCard`/`useBulkMoveCards`); the
invite pages still use `lib/invite/inviteApi.acceptInvite` (its `InviteError`
taxonomy) rather than `useAcceptInvite` (CogError). Memo-save surfaces already
route through the outbox; `useMemoSave` is their canonical hook face.

**Dependencies for other agents:**
- A4: your `invalidationMap`/`invalidateFor` are consumed by every mutation hook.
  `moveNode` is intentionally NOT called on a successful move (optimistic-only, no
  refetch); it's only used implicitly via the error-path `invalidateQueries`.
- D (canvas): adopt `useMoveCard(songId)` / `useBulkMoveCards(songId)` — they
  give the instant-drag-no-board-refetch contract you hand-roll today.
- Capture/ReviewSheet: `useCommitTake()` is idempotent and owns the room
  invalidation + new-song catalog refresh; `useCreateSong()` owns the song-quota
  → upgrade moment.
- Invite lane: `useInviteMember()` / `useAcceptInvite()` are the CogError-coded
  canonical path; migrating off `inviteApi`'s `InviteError` unifies the taxonomy.
- All voice surfaces: `useMemoSave()` is the ONE memo-save hook; never call
  `uploadVoiceMemo` / `saveMemoDurable` / `enqueueCaptureUpload` directly.

## Step 8/10 — Realtime primitives → invalidation hooks (2026-07-08)

**Goal:** wrap the clean realtime primitives as hooks that INVALIDATE cached
queries — never stream content. A remote change re-renders the right screen by
marking the owning `qk` query stale (React Query refetches the real content),
not by pushing a row into component state. Channels carry table + event kind
(IDs only); payloads are dropped on the floor.

**New file `src/hooks/useRealtime.ts`** — three hooks, each `useEffect`-keyed on
its id, returning the primitive's `removeChannel` unsubscribe directly:
- `useRealtimeSong(songId)` over `subscribeSongRoom`. change→invalidation:
  `onActivity`→`activity(id)`(+digest via prefix)+`songDetail(id)`;
  `onCardChange`→`canvas(id)`+`songDetail(id)`; `onTakeChange`→`memos(id)`+
  `songDetail(id)`; `onCaptureChange`→`captures(id)`+`songDetail(id)`. The
  `songDetail` invalidation is what refreshes the hub count badges.
- `useRealtimeMemos(songId)` over `subscribeMemos`. memo row change→`memos(id)`+
  `songDetail(id)`; transcript arrival→`memos(id)` only (a transcript doesn't
  move a count). `event` is used ONLY to tell the two apart, never to read the
  memo.
- `useRealtimeBilling(userId)` over the NEW seam primitive `subscribeBilling`
  (added to `cog/realtime.ts`). subscription change→`subscription(userId)`+
  `billing()`; storage change→ + `storage()`.

**Folded `useSubscription.ts`** onto the shared pattern: deleted its inline
`supabase.channel('sub-…')` + double `subQuery.refetch()` `useEffect` and its
`useEffect` import; it now calls `useRealtimeBilling(userId)`. Invalidating
`qk.subscription(userId)` refetches the very query the hook observes (same net
effect as the old `refetch()`), and now ALSO nudges `qk.billing()`/`qk.storage()`
so `useBillingStatus`/`useStorageUsage` (Step 6) re-hydrate too. `supabase` is
still imported there for the `auth.getUser()` read (acceptable auth-read class).

**IDs-only enforced structurally:** the song-room handlers take no payload
argument at all; the memo handler destructures `{ event }` only. No `payload.new`
/`payload.old` is read anywhere in the hooks — content cannot leak down the
realtime path.

**Verified (concrete, on current HEAD):**
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**.
- `npx vite build` → **built in 6.7s, exit 0**.
- New suite `src/test/use-realtime.test.tsx` → **5/5**: each song-room event maps
  to its exact keys (content ignored); memo vs transcript split; billing
  subscription vs storage split; stable-id rerender does NOT re-subscribe;
  unmount calls `removeChannel` once; **remount = 2 subscribes / 1 unsubscribe =
  exactly one live channel (no leak/duplicate)**.

**Dependencies / adoption for other agents:**
- D (canvas): `SongCanvasExperience.tsx` still calls `subscribeSongRoom` inline
  to `hydrateVoiceMemos()` on every event — adopt `useRealtimeSong(songId)` +
  `useCanvasCards`/`useMemos` to move onto invalidation instead of imperative
  re-hydrate.
- E2 (activity): `useActivityFeed.ts` hand-rolls a `subscribeSongRoom` that
  invalidates its bespoke `["activity-rows"]`/`["activity-digest"]` keys —
  `useRealtimeSong` covers `qk.activity(id)`; migrate the feed's keys to `qk`
  (flagged in Step 5) and it can drop its own channel.
- Any voice surface (VoiceMemosPage, memo panels): `useRealtimeMemos(songId)`
  keeps the `qk.memos` cache live; pair with `useMemos` from Step 6.
- A4: these hooks invalidate `qk` keys directly (parity with `useActivityFeed`);
  they do not go through `invalidationMap` because that maps LOCAL mutations, not
  remote events. If you want remote events funneled through a policy table, add a
  `remoteEvent` map and I'll point the hooks at it.

## Step 9/10 — Harden the boundary (2026-07-08)

**Goal:** the frontend↔backend seam survives a bad environment, a dead network,
and a full storage plan without ever hanging a screen or losing a take.

**1 — Env guard (`src/integrations/supabase/client.ts`).** `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY` are now read as `string | undefined` (typed) and
a fail-fast guard throws a clear, actionable message naming the missing var(s)
BEFORE `createClient` runs. Previously a missing var surfaced deep in the SDK as
an opaque "supabaseUrl is required" at the first call; now the boot failure is
legible. The throw also narrows both to `string`, so `createClient` no longer
sees `undefined`. Kept the "auto-generated" header + added an explicit
"preserve this guard" note (Lovable regenerates this file).

**2 — OFFLINE code + read-timeout policy (`src/integrations/cog/errors.ts`).**
- New `"OFFLINE"` member on `CogErrorCode` (client-only; never sent by the
  server, so NOT added to `KNOWN_CODES`/`SERVER_CODE_MAP`).
- `toCogError` now maps a network failure → `OFFLINE`: when `navigator.onLine`
  is false OR the message shape is `failed to fetch` / `networkerror` / `network
  request failed` / `load failed` / `fetch failed` / `timed out` / `timeout`.
  Placed AFTER the SQLSTATE + auth branches so a real server error still wins.
- New exports: `isOffline()` (the ONE shared connectivity signal so the read
  layer + the Capture Outbox agree), `READ_TIMEOUT_MS` (12s), and
  `withTimeout<T>(promise, ms?)` — rejects immediately when offline, else on the
  timer, always with `CogError("OFFLINE")`. Reads-only (documented: never wrap a
  write — a timed-out write may still land; writes go through the idempotent
  outbox).
- Wired into ALL ten read hooks in `src/hooks/useAppQueries.ts` (each `queryFn`
  now `() => withTimeout(cogFn(...))`). Net effect: an offline/stalled read
  rejects with `OFFLINE` instead of spinning; React Query RETAINS the last
  cached value (`data` stays, `error.code === "OFFLINE"`) → cached data + a calm
  offline signal, no blocking modal. Added a "TIMEOUT POLICY" note to the file
  header.

**3 — The outbox is the ONE write path for every recorded take.** Verified, not
just claimed: `grep` for take-write calls across `src/pages` + `src/components`
→ **6 sites, ALL through the outbox** (`saveMemoDurable` or
`enqueueCaptureUpload`): `VoiceMemosPage` recorder save (L586) AND the file
upload handler `handleFileUpload` (L636 — the "last direct handler" the step
names; already on `saveMemoDurable` from Step 7's collapse, re-confirmed),
`VoiceLayerPanel`, `SectionVoiceDock`, `BrainstormPage`, `CaptureScene`. **Zero**
direct `uploadVoiceMemo(` / `submitSharedAudio(` write calls in any page/
component — those names now live only inside the outbox uploader registry (sync
time) + the seam.

**4 — QUOTA_EXCEEDED_STORAGE on upload = RETAIN-and-retry, like offline
(`captureOutbox.ts`).** Before, a storage-full upload was treated as a generic
failure: `status:"failed"`, attempt incremented, PARKED after 6 tries. Now
`processJob`'s catch detects it (`isStorageQuotaError` — matches the CogError
`.code === "QUOTA_EXCEEDED_STORAGE"` and tolerates the raw
`storage_limit_reached` slug in a message) and handles it EXACTLY like the
offline branch: patch `status:"queued"`, do NOT burn an attempt, emit
`failed{ willRetry:true, reason:"quota_storage" }` and return. The take stays
safe in the cache and auto-syncs on the next heartbeat/`online` once storage is
added — never parked, never lost. `OutboxEvent.failed` gained an optional
`reason: "offline" | "quota_storage" | "upload"` (additive — every existing
consumer only reads `willRetry`/`type`, verified). `VoiceMemosPage`'s outbox
subscription adds one branch: on `reason === "quota_storage"` it keeps the
optimistic card ("Saved on device · syncing") and sets the existing calm gold
notice to "Saved on your device — we'll sync it once there's room. Add storage
to finish." (reuses the existing notice UI; no new component/styling).

**Verified (concrete, on current HEAD):**
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**.
- `npx vite build` → **built in 6.7s, exit 0**.
- `captureOutbox.test.ts` → **13/13** (added 2: storage-full retains + stays
  queued with attempts 0 and emits `reason:"quota_storage"`; and auto-syncs once
  storage is added, no re-record). `cog-errors` **16/16**, `use-mutations`
  **8/8** still green.
- Event-shape regression: `CaptureScene` (+lifecycle) **5/5**, `pendingUploads`
  **9/9**, `captureUploaders` **2/2**, `seedIdeaApi` **9/9** → the added optional
  `reason` broke no consumer.
- Outbox coverage grep (above): 6 write sites, all through the outbox; 0 direct
  bypass.

**Done-check results:** env missing → app throws a clear named-variable error at
client init; an offline read rejects `OFFLINE` while React Query serves the
cached value (data + OFFLINE signal, no spinner); every recorded take incl. file
upload goes through `enqueueCaptureUpload`; a simulated over-quota upload RETAINS
the take (queued, attempts 0, blob kept) and surfaces "Saved · will sync" + "Add
storage"; tsc green.

**Dependencies for other agents:**
- Feature/UI agents: `error.code === "OFFLINE"` is a NEW code your read screens
  can switch on for a calm offline banner — the cached `.data` is still valid,
  do NOT clear the screen. Subscribe to the outbox and branch on
  `event.reason === "quota_storage"` to render an "Add storage" prompt (the take
  is safe + auto-retrying; never show data-loss copy).
- A4: `withTimeout` wraps every read in `useAppQueries`; an `OFFLINE` rejection
  is a normal fail-soft error, not something to hard-retry aggressively — the
  client `retry:1` default is right. `isOffline()` in `cog/errors` is the shared
  signal if you want offline-aware invalidation gating.
- Voice/capture agents: `OutboxEvent.failed.reason` is now available
  (`offline`/`quota_storage`/`upload`); the quota case is retain-and-retry
  (queued, never parked) — do not treat it as a hard failure.
- Lovable: the env guard in the generated `client.ts` is hand-added and must be
  preserved on regeneration.

## Step 10/10 — Lock the layer: tests + how-to (2026-07-08)

**Goal:** fence the whole data layer with an integration-style critical-path
suite and ship the doc a new dev follows to add a data module. This is the
launch-readiness gate for A4/A5 + every feature agent.

**New suite `src/test/data-access-critical-paths.test.tsx` (24 tests, all green).**
One file, mocks the Supabase client (`functions.invoke` / `auth.getUser` / `rpc`
/ `channel` / `removeChannel`) + the outbox IO (`audioCache` / `voiceApi`), and
exercises the REAL seam fns / hooks across 11 critical paths so a data-layer
regression fails here before it reaches a screen:
1. **auth session load** — `getSessionUser` returns the user / resolves `null`
   signed-out (fail soft, never throws).
2. **catalog read** — `listMySongs` returns RPC rows; an RLS `42501` normalizes
   to `FORBIDDEN`.
3. **workspace read (counts)** — `getSong` projects the RPC row into the typed
   `counts` object; a non-member row → `null` (calm, not a throw).
4. **quick capture (optimistic)** — `useQuickCapture` prepends the card before the
   server answers AND rolls back to the snapshot on rejection.
5. **memo save via outbox** — a retried upload reuses the SAME idempotency key
   (retry never double-creates + clears on success); an over-quota upload RETAINS
   the take (`queued`, attempts 0, blob kept, pending 1).
6. **commit take (idempotent)** — committing the same take twice returns the same
   `card_ids` (edge dedupes); a new-song commit over quota → `QUOTA_EXCEEDED_SONGS`.
7. **accept invite** — each server slug → its code
   (`invite_expired`→INVITE_EXPIRED, …_not_found, …_already_used, …_exhausted,
   forbidden→FORBIDDEN) + a valid token resolves the membership payload.
8. **billing snapshot** — `getMyBillingStatus` returns plan/storage/song_quota;
   an edge failure → `CogError`.
9. **realtime → invalidation** — `useRealtimeSong` fires a captured `song_activity`
   handler WITH a content payload → invalidates `qk.activity`+`qk.songDetail` and
   the payload is ignored (IDs-only proven); `canvas_cards`→`qk.canvas`; unmount
   → exactly one `removeChannel`.
10/11. **normalized error contract** — edge (`call`) `{ok:false,code:FORBIDDEN}`
   envelope → FORBIDDEN and `storage_limit_reached` slug → QUOTA_EXCEEDED_STORAGE;
   direct (`toCogError`) 42501 → FORBIDDEN + a RAISEd `QUOTA_EXCEEDED_STORAGE`
   token survives.

**New doc `docs/DATA-ACCESS.md`** — the how-to a new dev follows: the layer
diagram (component → hook → seam → client), how to add a seam fn (`toCogError`
for direct / `call` for edge; never `throw error`), the code table the UI
switches on, how to add a read hook (`qk` + `withTimeout` + fail-soft), the `qk`
factory + prefix-match invalidation convention (writes go through A4's
`invalidationMap`, never ad hoc), how to add a mutation hook (optimistic +
rollback; quota = moment not toast), the OUTBOX rule (every take through
`useMemoSave`; idempotent; offline + over-quota RETAIN), the IDs-only realtime
rule (invalidate, never read `payload.new`), and a copy-paste checklist for a new
data module.

**Verified (concrete, on current HEAD):**
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors** (whole-tree clean).
- New suite `data-access-critical-paths` → **24/24**.
- Data-layer regression sweep — `data-access-critical-paths` 24 + `cog-errors`
  16 + `use-mutations` 8 + `use-realtime` 5 + `captureOutbox` 13 +
  `client-state`(A4) 7 → **73/73 across 6 files**. The two done-check invariants
  are explicitly asserted: retry-never-duplicates (same idempotency key, cleared
  on success) and over-quota-retains (queued, attempts 0, blob kept).

**Done-check result:** the critical-path tests are green (including
retry-never-duplicates and over-quota-retains) and a new dev can add a data
module end-to-end by following `docs/DATA-ACCESS.md`.

**The data layer is launch-ready.** Summary of the contract other agents build on:
- **A4:** `qk` (`@/hooks/queryKeys`) is the canonical key vocabulary; your
  `invalidationMap`/`invalidateFor` is the single write→keys policy and is
  consumed by every mutation hook. Realtime hooks invalidate `qk` directly (remote
  events aren't local mutations). Read hooks fail soft on `OFFLINE` — `retry:1` is
  right, don't hard-retry. Outstanding cross-lane flag still open from Step 5:
  feature hooks holding `["song-detail"]`/`["song-members"]` inline keys won't
  match `qk.songDetail`/`qk.songMembers` until they migrate.
- **A5:** no routing impact; the quota codes drive the `/upgrade` + storage
  MOMENTS your routes host.
- **Feature/UI agents:** catch a `CogError`, switch on `.code` (never `.message`);
  quota codes are moments not toasts; consume the read/write/realtime hooks in
  `src/hooks/**`, never `supabase.*`; route every recorded take through
  `useMemoSave`. Full playbook: `docs/DATA-ACCESS.md`.
