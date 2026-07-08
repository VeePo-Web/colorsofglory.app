# A2 Domain Types — Progress Log

Branch: `worktree-a2-domain-types` (dedicated worktree off origin/main).
Charter: own the single Database-derived TYPE CONTRACT; `@/types` barrel; lint-block drift.

## Baseline (recorded Step 1)
`npm run typecheck` → **22 pre-existing errors** on this worktree.
- GROUP 1 (A2 will resolve by building the barrel): `@/types/role` missing in
  `src/components/roles/MemberRow.tsx`, `src/lib/permissions/{capabilities,useCapabilities,useSongRole}.ts`;
  `@/types` missing in `src/test/version-history.test.ts`.
- GROUP 2 (NOT A2 — leave): CaptureScene.tsx (resolveTakeId/waitForOutboxResult/QueuedTakeNotice),
  activity-feed.test.tsx, cog-founder-code-page.test.tsx, voice-memo-added.test.tsx,
  version-history.test.ts property drift (SongSnapshotV1.sheet / SnapshotSummary.key/bpm).
Delta rule: create/edit clean, zero NEW errors, reduce count by satisfying Group-1 imports.

## Step 1 — Type-contract law established ✅
- Wrote `docs/TYPE-CONTRACT.md`: three governing rules (generated file never hand-edited;
  every domain type DERIVES from `Database` via Tables<>/TablesInsert<>/Enums<>, no forked
  enums/parallel interfaces; domain types imported ONLY from `@/types`). Documented roles
  round-trip (DisplayRole 4 → SongMemberRole 3, contributor/reviewer→collaborator LOSSY),
  Credits-vs-billing separation, and type-layer-owned vocabularies (SongActivityKind, canvas
  IdeaCardType/Status).
- Linked from `CLAUDE.md` §0 (Type-contract law paragraph). NOTE: worktree CLAUDE.md was off
  origin/main and did NOT yet contain the link; added it.
- Verified tracked product gaps against real files (all flagged "do not invent a type"):
  - Gap A: mockup activity events with no `SongActivityKind` member — lyric edit, chord
    suggestion, comments (`activity.ts:25-41` vs `download (20).webp`).
  - Gap B: Pro price $100 seed (`migrations/…052727:21` pro_price_cents=10000; `_shared/stripe.ts:102`)
    vs $12 mockup (`UpgradePage.tsx:147`) — still present.
  - Gap C: no `chord_positions` table; chords in `song_lyrics.content` Json (`types.ts:1420`).

Verified: TYPE-CONTRACT.md exists, states 3 rules, lists gaps, linked from CLAUDE.md.

## Step 2 — Canonical domain-type home scaffolded ✅
- Created `src/types/` with `index.ts` barrel + 17 per-domain files: song, section, lyrics,
  voice, member, role, invite, version, activity, note, canvas, capture, credit, memory,
  billing, error, enums. index.ts `export *`s all 17.
- POPULATED BY RE-EXPORT ONLY (no relocation yet — that's Step 3). Each file uses explicit
  `export type { … } from "<current home>"`. Homes verified by grep:
  song←cog/songs, voice←cog/{memos,takes,transcript}, member←cog/members, role/enums/error/
  invite←cog/songs, version←cog/versions, activity←cog/activity, note←cog/notes,
  canvas←cog/canvas + lib/canvas/canvasTypes, capture←cog/capture, memory←cog/memory,
  billing←cog/{billing,storage}. section/lyrics/credit = `export {}` placeholders
  (no types exist yet; credit is greenfield, flagged NEVER-conflate-with-billing).
- COLLISION GUARD: each type name has exactly ONE home file so the barrel's star-exports
  never go ambiguous. Notably `SongMemberRole` lives ONLY in role.ts (not enums.ts);
  `TranscriptStatus` re-exported only from transcript.ts (memos.ts's dupe skipped).
- Verified:
  - `npm run typecheck` delta: baseline 22 → **17** (−5). Resolved exactly the Group-1 set:
    4× `@/types/role` (MemberRow, permissions/{capabilities,useCapabilities,useSongRole})
    + 1× `@/types` (version-history.test.ts:20 SongVersion). ZERO new errors. All remaining
    17 are Group-2 (CaptureScene ×3, activity-feed.test ×2, cog-founder-code ×1,
    version-history.test property drift ×10, voice-memo-added.test ×1) — not A2's lane.
  - Scratch smoke file: `import type { Song, SongMember, VoiceMemo } from '@/types'` and
    `SongMemberRole from '@/types/role'` both compile clean (no `@/types` errors). Deleted.

## Step 3 — Domain type declarations RELOCATED into src/types/ ✅
The 17 scaffold re-exports are now real DECLARATIONS in `src/types/*`; the source cog
files import them back from `@/types` and re-export for backwards compat (deep importers
migrate in Step 10). No logic touched — only type decls removed + import/re-export lines added.

Moved (declaration now lives in the type file, source file imports it back):
- `song.ts` ← cog/songs: `Song`, `SongCard`, `SongDetail`, `SongActivityRow`, `SongNotificationPrefs`
- `enums.ts` ← cog/songs: `SongStatus`
- `role.ts` ← cog/songs: `SongMemberRole`
- `invite.ts` ← cog/songs: `SongInvite`, `InvitePreview`
- `error.ts` ← cog/songs: `CogErrorCode` (the `CogError` CLASS stays in cog/songs — runtime value)
- `voice.ts` ← cog/memos: `VoiceMemo`, `VoiceMemoTranscript`, `MemoLifecycle`; ← cog/takes: `Take`;
  ← cog/transcript: `TranscriptBlock`, `TranscriptPayload`, `TranscriptStatus`, `TakeTranscriptRow`
- `member.ts` ← cog/members: `SongMember`
- `version.ts` ← cog/versions: `SongVersion`, `VersionKind`, `SnapshotSection`, `SongSnapshotV1`,
  `SnapshotSummary`, `VersionActivityKind`, `RestoreResult`
- `activity.ts` ← cog/activity: `SongActivityKind`, `ActivityDigestRow`, `RecapDigest`
- `note.ts` ← cog/notes: `SongNote`, `NoteActivityKind`
- `canvas.ts` ← cog/canvas: `CanvasCard`, `CommitTakeResult`
- `capture.ts` ← cog/capture: `IdeaCapture`
- `memory.ts` ← cog/memory: `LoadedMemory`, `VaultExportOutcome`
- `billing.ts` ← cog/billing: `Subscription`, `StorageAddon`, `PlanId`, `PlanKey`, `BillingStatus`,
  `PlanTier`, `PricingCard`; ← cog/storage: `StorageUsage`

Kept as RE-EXPORTS from their dedicated lib type-modules (not cog function files, so their
canonical home stays — matches the memory instruction), surfaced through the barrel:
- `canvas.ts` re-exports canvas vocabularies from `@/lib/canvas/canvasTypes` (IdeaCardType,
  IdeaCardStatus, CanvasZone, CanvasObjectType, IdeaCard, CanvasNode, CanvasEdge, CanvasBoardTree,
  CanvasBoardCardType, CanvasBoardCardStatus, CanvasBoardDimReason, CanvasBoardCard, SongCanvasState).
- `memory.ts` re-exports MemoryGraph & friends from `@/lib/memory/memoryTypes` (14 names) — barrel
  surface EXPANDED vs Step 2 scaffold per task scope; no collisions.

Deliberate NON-moves (flagged, not hidden):
- `SectionKind`: a DIFFERENT UI-oriented `SectionKind` already exists in
  `src/lib/capture/transcriptModel.ts`. Publishing a second `SectionKind` from the barrel would be a
  footgun, so the snapshot codec keeps a PRIVATE local alias in `src/types/version.ts` (and cog/versions
  keeps its own private one, unchanged). Not exported from `@/types`.
- Two name-collisions left in place: memo-level `TranscriptStatus` (cog/memos) vs take-level
  `TranscriptStatus` (barrel/src/types/voice — the surfaced one); and `ValidateCodeResult`
  (cog/billing vs lib/pricing/pricingApi). Distinct concepts sharing a name — documented, not merged.
- Function-local DTOs left with their callers (exported but used only in their own file, imported
  nowhere else): CreateUploadUrlInput/Result, FinalizeUploadInput (memos); QuickCaptureInput,
  PromoteCaptureInput/Result (capture); CommitTakeInput, BulkMoveItem (canvas); PricingPageCopy,
  FaqItem, PriceId, ValidateCodeResult (billing).
- `cog/ledger.ts` re-declares `Subscription` (identical Database row, UNUSED, zero importers) inside
  the separate billing/money ledger surface (RewardEvent/CreditLedgerRow/Payout/Founder/ReferralCode/
  ReferralAttribution/Subscription/AuditLog). Left untouched — consolidating one of eight piecemeal
  would be inconsistent out-of-lane churn. FLAG: fold the whole ledger/money surface into the barrel
  in a dedicated billing-types pass.

Verified:
- `npm run typecheck` → still **17 errors, byte-identical to the Step-2 baseline set** (CaptureScene ×3,
  activity-feed.test ×2, cog-founder-code ×1, version-history.test property drift ×9, voice-memo-added ×1).
  ZERO new errors introduced by the relocation. All are Group-2 (other agents' WIP), not A2's lane.
- `npm run build` → GREEN (`✓ built in ~7.8s`; only the pre-existing >500 kB chunk-size warning).
- Grep: NO `src/types/*.ts` imports from `@/integrations/cog/*` — the type layer has zero reverse
  dependency on cog, so no import cycle (cog→@/types edges are all `import type`, erased at runtime).
- Grep: no moved domain type is still DECLARED in a cog file (only re-export lines remain).

## Step 4 — Role model reconciled to ONE canonical home ✅
Direction chosen: **canonical-in-types, shims delegate** (least-breaking — every existing
`@/lib/invite/roles` + `@/lib/invite/inviteApi` import path keeps working unchanged).

- `src/types/role.ts` is now the SINGLE home for the whole role vocabulary:
  `SongMemberRole` (DB, `Enums<'song_member_role'>`), `DisplayRole` (UI 4),
  `RoleDisplay` + `ROLE_DISPLAY` (labels/blurbs, moved verbatim from roles.ts — owner
  label = "Owner"), `ROLE_CAPABILITY` (verbatim capability sentences, DERIVED from
  `ROLE_DISPLAY.selectDesc` so there's one authored copy), `ROLE_PERMISSIONS` +
  `RolePermissions` (human-readable grant summary), `displayRoleToDb`
  (contributor/reviewer→collaborator LOSSY, viewer→viewer, owner→owner) and
  `dbRoleToDisplay` (collaborator→contributor LOSSY default). role.ts imports ONLY
  `Database` — no dep on roles.ts or the permissions layer (avoids a cycle).
- `src/lib/invite/roles.ts` collapsed to a thin COMPAT SHIM: re-exports the canonical
  values and keeps legacy aliases `UiRole=DisplayRole`, `DbRole=SongMemberRole`,
  `dbRoleToUi=dbRoleToDisplay`, `uiRoleToDb=displayRoleToDb`, `ROLE_DISPLAY`,
  `RoleDisplay`, `roleLabel`. No divergent copy remains.
- `src/lib/invite/inviteApi.ts` `dbRoleToUi`/`uiRoleToDb` now DELEGATE to the canonical
  functions (dbRoleToUi narrows owner→contributor for the invite-only UI set); its
  `DbRole` is now an alias of `SongMemberRole`. `inviteContext.ts` `InviteRole` left as a
  flow-local sessionStorage union (not a competing definition) with a canonical-home note.
- ENFORCEMENT untouched + not duplicated: the boolean permission GATE stays solely in
  E1's `src/lib/permissions/capabilities.ts` (`ROLE_CAPABILITIES`); `ROLE_PERMISSIONS` is
  display-only. capabilities.ts consumes the canonical maps via the roles.ts shim, unchanged.
- TYPE-CONTRACT.md updated: reconciliation direction recorded + FILED a Lovable schema
  request (add `reviewer` enum value OR `can_approve`/`is_reviewer` column) so a true
  stored Reviewer becomes lossless; until then Reviewer stays a permission flag.

Verified:
- `npm run typecheck` → **17 errors, byte-identical to the Step-3 baseline set** (CaptureScene
  ×3, activity-feed.test ×2, cog-founder-code ×1, version-history.test property drift ×9,
  voice-memo-added ×1). ZERO new errors; none in any file A2 touched. All Group-2 (other
  agents' WIP), not A2's lane.
- `npx eslint` on all 7 touched/consumer files (role.ts, roles.ts, inviteApi.ts,
  inviteContext.ts, capabilities.ts, RolePicker.tsx, RoleBadge.tsx) → clean, no output.
- `npm run build` → GREEN (`✓ built in 6.95s`; only the pre-existing chunk-size warning).
- `roleLabel('owner')` → "Owner" (ROLE_DISPLAY.owner.label); all four labels intact.

## Step 5 — Domain enums canonicalized in src/types/enums.ts ✅
Every DB enum is now a `Enums<'x'>` alias PLUS a runtime `as const` array taken
from the generated `Constants.public.Enums.x` (ZERO hand-typed values — pure
DERIVE), and user-facing enums get a `*_LABELS` map. No feature agent needs to
re-type an enum.

Inventory (type / runtime array / label map):
- section_kind → `SectionKind` / `SECTION_KINDS` / `SECTION_KIND_LABELS` (user-facing)
- memo_status → `MemoStatus` / `MEMO_STATUSES` / `MEMO_STATUS_LABELS` (user-facing)
- transcription_status → `TranscriptionStatus` / `TRANSCRIPTION_STATUSES` / `TRANSCRIPTION_STATUS_LABELS`
- version_kind → `VersionKind` / `VERSION_KINDS` / `VERSION_KIND_LABELS`
- song_status → `SongStatus` / `SONG_STATUSES` / `SONG_STATUS_LABELS`
- invite_status → `InviteStatus` / `INVITE_STATUSES` / `INVITE_STATUS_LABELS`
- onboarding_step → `OnboardingStep` / `ONBOARDING_STEPS` / (NO label map — internal state machine)
- sub_plan → `SubPlan` / `SUB_PLANS` (billing axis)
- plan_tier → `EntitlementTier` / `ENTITLEMENT_TIERS` (coarse entitlement axis; named
  `EntitlementTier` NOT `PlanTier` to avoid collision with the pricing-config OBJECT
  `PlanTier` in ./billing — two distinct concepts, kept apart)

Plans — both axes kept distinct + classifiers added:
- `isPro(plan: SubPlan)` → true for `pro`|`founder_pro` (mirrors DB `is_pro_user` =
  `current_plan(...) IN ('pro','founder_pro')`; `starter`/`free` are NOT Pro).
- `isPaidPlan(plan)` → true for any non-free (`starter`|`pro`|`founder_pro`), mirroring
  the migrations' paid set. Verified: isPro('founder_pro')=T, isPro('starter')=F, isPaidPlan('starter')=T.
- `./billing` `PlanId` no longer forks the union — now `= SubPlan` (derives from DB enum).

Type-layer-owned vocabularies (DB stores bare string; already barrel-exported, NOT
re-exported from enums.ts to avoid a duplicate star-export): `SongActivityKind`
(./activity, values authored in cog/activity.ts) and `IdeaCardType`/`IdeaCardStatus`
(./canvas → lib/canvas/canvasTypes). enums.ts carries a pointer comment to them.

Collision resolved during this step: `VersionKind` had been relocated to ./version in
Step 3 AND is a DB enum → belongs in ./enums. Made ./enums the single home; ./version
now imports `SectionKind` from ./enums and does NOT re-export `VersionKind` (barrel gets
it from ./enums). Same for `SectionKind` (./version dropped its private local alias).

Flags for product/Lovable (recorded in TYPE-CONTRACT.md):
- sub_plan→plan_tier coarse mapping is NOT authored in the type layer: `plan_tier` enum
  has no `starter` member, so where `starter` lands (free vs pro coarse tier) is a backend
  decision (`plan_tier_key_for_user` returns the 3-value plan_tiers.key, a different axis).
  Did NOT invent the bridge function — flagged instead.
- `src/lib/pricing/pricingApi.ts:13` still hand-authors `SubPlan = 'free'|...|'founder_pro'`
  (a fork). Left for the Step 10 codemod to repoint at `@/types`.

Verified:
- `npm run typecheck` → **17 errors, byte-identical to the Step-4 baseline set**; ZERO new
  errors; no error in any file A2 touched. All Group-2 (other agents' WIP).
- Scratch smoke: imported all 9 enum types + runtime arrays + `isPro`/`isPaidPlan`/`PlanId`
  from `@/types` — compiled clean; isPro/isPaidPlan classify as expected.
- `npx eslint` on enums.ts / billing.ts / version.ts → clean.
- `npm run build` → GREEN (`✓ built in 6.86s`).

## Step 6 — Workspace view-models homed with provenance + Credit greenfield ✅
Every client view-model now lives in `src/types/`, surfaced through the barrel, each
with a doc comment classifying it as a 1:1 ROW ALIAS or a COMPOSED view and naming its
source table(s). Confirmed already-relocated (Step 3) and strengthened provenance:
- `song.ts`: `Song` (1:1 alias songs); `SongCard` (composed list RPC); `SongDetail`
  (composed get_song RPC; nested `counts` VERIFIED byte-for-byte against
  cog/songs.ts:186-193 — `{ sections, lyrics_filled, voice_memos, notes, collaborators,
  pending_suggestions }`); `SongActivityRow`/`SongNotificationPrefs` composed.
- `member.ts`: `SongMember` (composed list_song_members RPC = song_members ⨝ profiles).
- `voice.ts`: `VoiceMemo`/`VoiceMemoTranscript` (1:1 aliases); `Take` (takes read subset);
  `TranscriptBlock`/`TranscriptPayload`/`TakeTranscriptRow` (composed take-level transcript).
- `canvas.ts`: `CanvasCard` (canvas_cards read subset); `CommitTakeResult` (edge-fn result).
- `capture.ts`: `IdeaCapture` (idea_captures read subset).
- `memory.ts`: `MemoryGraph` & friends (composed, re-exported from lib/memory/memoryTypes).
- `billing.ts`: `Subscription`/`StorageAddon` (1:1 aliases); `BillingStatus` (composed
  billing-status edge fn; nested storage/addons[]/song_quota); `PlanTier`/`PricingCard` composed.

GREENFIELD Credit types authored in `src/types/credit.ts` (was a Step-2 `export {}` stub):
- `ContributionType` union canonicalizing the fixture + Credits Review mockup vocabulary:
  lyrics | arrangement | voice_memo | chord_suggestion | original_idea | section_idea |
  review | comment | recording. Plus `CONTRIBUTION_TYPES` (const array) +
  `CONTRIBUTION_TYPE_LABELS` (singular labels).
- `Contribution` = { type; count?; sectionLabel? } (count rolls up "Voice memo ×3";
  sectionLabel scopes "Bridge idea"/"Chorus review").
- `Credit` = { userId; name; initials; role: DisplayRole; isOwner; auroraColor;
  contributions: Contribution[] }.
- Header FLAGS it loudly: GREENFIELD/UI-DERIVED, NO DB table (client-derived from canvas
  cards via lib/canvas/credits.ts + CreditsPage.tsx), EXPORTABLE, and ⚠️ NEVER conflate with
  the billing `credit_ledger` (money).

Verified:
- `npm run typecheck` → **17 errors, byte-identical to the Step-5 baseline set** (CaptureScene
  ×3, activity-feed.test ×2, cog-founder-code ×1, version-history.test property drift ×9,
  voice-memo-added ×1). ZERO new errors; none in any A2-touched file. All Group-2.
- `npx eslint` on all 7 touched type files → clean, no output.
- Scratch smoke: imported Credit/Contribution/ContributionType/CONTRIBUTION_TYPES/
  CONTRIBUTION_TYPE_LABELS + SongCard/SongDetail/SongMember/VoiceMemo/Take/TakeTranscriptRow/
  CanvasCard/IdeaCapture/MemoryGraph/BillingStatus from `@/types`; built a `Credit` literal and
  a `SongDetail["counts"]` literal — compiled clean. Deleted.

## Step 7 — src/types/error.ts is the single error taxonomy ✅
One domain error type + guards now live in the barrel; the `CogError` CLASS moved
out of cog/songs.ts into src/types/error.ts (last runtime value still homed in a
cog function file).

- `src/types/error.ts` now homes: `CogErrorCode` union (added `OFFLINE`);
  `CogErrorCodeLike = CogErrorCode | (string & {})` as the documented escape;
  the `CogError` class with `.code` TIGHTENED from `CogErrorCode | string` to
  `CogErrorCodeLike` (known codes autocomplete, unknown wire codes still allowed);
  `isCogError(err): err is CogError`; `toCogError(err): CogError` (passthrough /
  `{code,message}` object / string / fallback → INTERNAL). Header states the UI
  RULE: switch on `.code`, never on `.message`.
- `cog/songs.ts` deleted its local `class CogError` and now `import { CogError }
  from "@/types"` + `export { CogError }` (back-compat). The three deep importers
  `members.ts` / `versions.ts` / `notes.ts` (`import { CogError } from "./songs"`)
  keep resolving unchanged. No function bodies touched — only the class decl removed
  and an import/re-export line added.
- AUTH DECISION: `AuthError`/`AuthErrorCode` (cog/auth.ts) kept DELIBERATELY
  SEPARATE — not folded, not surfaced through `@/types`. Reasons recorded in
  error.ts header + TYPE-CONTRACT.md: auth-SDK boundary (not COG edge fns),
  auth-only `retryAfterSeconds` field, non-overlapping code vocabulary. auth.ts
  itself untouched (out of lane).

Verified:
- `npm run typecheck` → **17 errors, byte-identical to the Step-6 baseline set**
  (CaptureScene ×3, activity-feed.test ×2, cog-founder-code ×1, version-history.test
  property drift ×10, voice-memo-added ×1). ZERO new errors; none in error.ts or
  songs.ts. All Group-2 (other agents' WIP).
- `npx eslint src/types/error.ts src/integrations/cog/songs.ts` → clean, no output.
- Scratch smoke: imported `CogError`/`isCogError`/`toCogError` (values) +
  `CogErrorCode`/`CogErrorCodeLike` (types) from `@/types`; `new CogError("OFFLINE")`,
  `isCogError(e)`, `toCogError({code,message})` all compiled clean. Deleted.

## Step 8 — Schema-drift discipline (regen + staleness gate) ✅
Added the mechanism that catches generated-file drift. No live regen here (no Supabase
CLI / project access in the worktree — that runs in CI/Lovable), so verification is static.

- `scripts/gen-supabase-types.mjs` (new, ESM house style): runs
  `supabase gen types typescript --project-id vsiecltcxsuuulbczexl --schema public`
  (ref overridable via `SUPABASE_PROJECT_ID`), prepends a fixed banner, writes
  `src/integrations/supabase/types.ts`. Guards: refuses to write if the CLI errors OR the
  output lacks `export type Database` → NEVER fabricates a passing generation.
- package.json scripts:
  - `types:gen` = `node scripts/gen-supabase-types.mjs`
  - `types:check` = `node scripts/gen-supabase-types.mjs && git diff --exit-code -- src/integrations/supabase/types.ts`
    (regenerate, then git's exit code is the gate: 0 = fresh, non-zero = stale/hand-edited).
- Banner added verbatim to the very top of `src/integrations/supabase/types.ts`
  ("GENERATED FILE — DO NOT EDIT … run `npm run types:gen` … caught in CI by
  `npm run types:check`"). It's a deterministic constant shared with the script, so an
  unchanged schema reproduces the file byte-for-byte → `types:check` yields no diff.
- TYPE-CONTRACT.md: added "Regeneration + drift gate (Step 8)" under Rule 1 documenting
  both scripts, `git diff --exit-code` semantics, the CI/`SUPABASE_ACCESS_TOKEN`
  requirement, and that live regen was intentionally skipped here.

Verified (static, no live CLI):
- `node --check scripts/gen-supabase-types.mjs` → syntax OK.
- `npm run types:gen` with no CLI on PATH → prints a clear failure, **exits 1**, and
  `sha256sum -c` confirms types.ts was **left untouched** (no corruption, no fake pass).
  Because `types:check` uses `&&`, a failed regen short-circuits before `git diff` — the
  check correctly fails rather than silently passing.
- `npm run typecheck` → **17 errors, byte-identical to the Step-7 Group-2 set**; banner is a
  comment, zero type impact. `npx eslint scripts/gen-supabase-types.mjs` → clean.
  `npm run build` → GREEN (`✓ built in 6.63s`).
- FLAG for CI owner (Codex): wire `npm run types:check` into CI where the `supabase` CLI +
  `SUPABASE_ACCESS_TOKEN` exist, so schema drift fails the build.

## Step 9 — Public type surface LOCKED with contract tests ✅
Two sibling contract-test files now fail CI on any breaking change to `@/types`,
split by what enforces them (runtime vs compile-time):
- `src/test/type-contract.test.ts` (RUNTIME, 54 tests, run by `npm test`): the
  generated enum arrays equal `Constants.public.Enums.*` (section_kind, memo_status,
  transcription_status, version_kind, song_status, invite_status, onboarding_step,
  sub_plan, plan_tier); every `*_LABELS` map's keys exactly cover its array;
  `song_member_role` runtime array = `[owner,collaborator,viewer]` and contains
  NEITHER "reviewer" NOR "contributor"; `ROLE_DISPLAY`/`ROLE_CAPABILITY`/
  `ROLE_PERMISSIONS` have exactly the four UI keys; the role round-trip
  (displayRoleToDb / dbRoleToDisplay / roleLabel) with the lossy collapse;
  isPro/isPaidPlan; CONTRIBUTION_TYPE_LABELS ↔ CONTRIBUTION_TYPES; CogError
  code/guard/coerce; and a 29-name checklist that the barrel re-exports the full
  public VALUE set.
- `src/test/type-contract.test-d.ts` (COMPILE-TIME, `expectTypeOf`): `SongMemberRole`
  `toEqualTypeOf` `owner|collaborator|viewer` (and `.not` the +reviewer union);
  `DisplayRole` exactly the four UI roles; `SongDetail["counts"]` exact six-key
  all-number shape; `CogErrorCode` locked to the full 18-code set; each const
  array's `[number]` element type equals its enum type (section/memo/transcription/
  version/song/invite/onboarding/sub_plan/plan_tier/contribution); enums DERIVE
  from `Database[...]["Enums"]`; `Song`/`VoiceMemo` equal their generated Rows;
  `SongMember.role` = `SongMemberRole`.

Wiring (both in CI's "vitest/tsc setup"):
- The `-d` file is compiled by the existing `npm run typecheck` (tsc, tsconfig.app
  includes src) AND by the new `npm run test:types` = `vitest run --typecheck
  --typecheck.only type-contract`.
- vitest.config.ts gained a `typecheck` block: `tsconfig: ./tsconfig.app.json`,
  `include: ["src/test/**/*.test-d.ts"]`, `ignoreSourceErrors: true`. It is NOT
  enabled globally (no `enabled: true`), so a plain `vitest run` / `npm test` is
  unchanged for other agents — typecheck only fires under the `--typecheck` flag.
  `.test-d.ts` is excluded from the runtime `test.include` glob, so `npm test`
  never collects it as a runtime file.

Verified (BOTH runs shown):
- PASS: `npm test` on the runtime file → **54 passed**. `npm run test:types` →
  **1 passed, no type errors** (11s). `npm run typecheck` → still **17**
  (byte-identical Group-2 baseline), ZERO from type-contract files.
- FAIL (deliberate break — added `| "reviewer"` to `SongMemberRole` in role.ts):
  `npm run test:types` → **1 failed / 3 TypeCheckErrors**; `npm run typecheck` →
  the 3 extra errors all in `type-contract.test-d.ts` (lines 54/56/111). Reverted;
  re-ran → green again (test:types no errors, typecheck back to 17).
- `npx eslint` on both test files + vitest.config.ts → clean, no output.

Invariants covered: (1) SongMemberRole = 3 stored values, never reviewer/
contributor; (2) DisplayRole = exactly 4 UI roles; (3) SongDetail.counts exact
key shape; (4) each enum const array ↔ its type (+ derives from Database);
(5) CogErrorCode = full known-code set; (6) barrel re-exports the full public
value + type surface; plus role round-trip, plan classifiers, contribution
vocabulary, and CogError behavior.

## Step 10 — `@/types` is the ENFORCED single import site ✅
The type contract is now lint-blocked: feature code imports domain types ONLY
from `@/types`, and a deep domain-type import from `@/integrations/cog/*` or the
generated Supabase file fails ESLint.

- MIGRATION: the linter (not a guess) enumerated **39 domain-type imports across
  30 files** still reaching into `@/integrations/cog/*` (the "~108" figure counted
  function imports too; only 39 were barrel-owned TYPES). All 39 repointed to
  `@/types` via an assertion-guarded codemod (each replacement asserted an exact
  1× match; CRLF-aware). Pure `import type` lines had their path swapped; mixed
  `import { fn, type X }` lines were SPLIT — functions stay at the cog module,
  types move to `@/types`. Net diff: 30 files, +44/−47 lines, import-only (verified
  per-file autocrlf-aware `git diff`; e.g. SongGridCard/SongListRow = 1 line each).
  Non-barrel locals correctly LEFT at cog (e.g. `ActivityEvent` in recapDigest.ts +
  its test, `PresenceIdentity`, `ScripturePassage`/`Translation`, all `cog/admin`
  result types, `AuthError`) — the rule targets only barrel-owned names.
- LINT RULE (`eslint.config.js`, `@typescript-eslint/no-restricted-imports`):
  - `paths` = one entry per cog module (songs/billing/canvas/capture/activity/
    memory/memos/members/notes/storage/takes/versions/transcript) listing that
    module's barrel-owned TYPE names in `importNames` (44 names total). FUNCTIONS
    and the runtime `CogError` class are NOT listed, so they still import from
    `@/integrations/cog/*` freely. Chose the TS-eslint variant (not the base rule)
    so it catches BOTH `import type {…}` and inline `import { fn, type X }`
    specifiers (verified) while leaving value/function specifiers alone.
  - Plus a whole-path block on `@/integrations/supabase/types` for feature code,
    with an override block re-allowing the sanctioned DERIVATION homes
    (`src/types/**`, `src/integrations/**`, `src/lib/voice/**`, `src/test/**`) —
    the type layer + data-access seams + contract tests may derive from the
    generated root; everyone else funnels through `@/types`. Zero current
    violators in feature code, so no new errors.
- BOTH sides shown:
  - FAIL: a temp `src/pages/__a2_violation_demo.tsx` importing `type SongMember`
    from `cog/members` + `type SongDetail` from `cog/songs` → **2 restricted-import
    errors**; the co-imported `getSong` function was NOT flagged. Deleted after.
  - PASS: `npx eslint .` on the real tree → **0** `no-restricted-imports` errors.
- Green checks (delta discipline):
  - `npm run lint` → the ONLY remaining errors are **16 pre-existing** repo debt
    (14 `@typescript-eslint/no-explicit-any` in cog data-access casts, 2
    `react-hooks/rules-of-hooks` in library cards) — all in out-of-lane function
    bodies, all on lines A2 never touched, from rule families already active in
    the original config. My rule contributes **0**; config diff is purely additive
    (two `no-restricted-imports` lines + const defs). ZERO new lint errors.
  - `npm run typecheck` → **17**, byte-identical Group-2 set (CaptureScene ×3,
    activity-feed.test ×2, cog-founder-code ×1, version-history.test property drift
    ×9, voice-memo-added ×1). The two codemodded test files (activity-feed,
    version-history) show only their PRE-EXISTING errors — `SongSnapshotV1`/
    `SnapshotSummary`/`SongActivityKind` now RESOLVE from `@/types` (errors are
    "property does not exist ON" the resolved type; version-history line numbers
    shifted −1 only because its 4-name multiline import collapsed). ZERO new.
  - `npm run build` → GREEN (`✓ built in 6.71s`; only the pre-existing >500 kB
    chunk-size warning).

**TYPE CONTRACT IS LAUNCH-READY AND STABLE.** One shape per concept, one import
site, lint-enforced. A3/A4/A5 and every feature agent: import domain types from
`@/types` ONLY — the deep-path escape hatch is now closed for barrel-owned types.
Functions still import from `@/integrations/cog/*` (A3's data-access modules).

## Next (post-Step-10 follow-ups, not blocking)
- The back-compat `export type { … }` re-exports in the cog files can now be
  DROPPED (no feature file imports barrel types from cog anymore) — a cleanup pass
  for whoever owns those data modules; left in place here to avoid out-of-lane churn.
- Promote `ActivityEvent` (cog/activity) into `@/types` if it becomes a shared
  domain type; today it's function-file-local (recapDigest + its test) and correctly
  unrestricted.
- Later billing-types pass: fold the `cog/ledger` money-row aliases into the barrel.
- Codex/CI: wire `npm run types:check` (Step 8) where the Supabase CLI +
  `SUPABASE_ACCESS_TOKEN` exist so schema drift fails the build. Pre-existing lint
  debt (16 errors) is out of A2's lane — flagged for the owning agents.
