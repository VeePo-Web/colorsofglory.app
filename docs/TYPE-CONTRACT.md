# TYPE CONTRACT — Colors of Glory

> The single, canonical law for domain types. Owned by the A2 Domain Types agent.
> One shape per concept, one import site. When this contract is fully enforced, no
> agent hand-authors a `Song`, `SongMember`, `VoiceMemo`, role, enum, or error code —
> every domain type is imported from the `@/types` barrel, which derives from the
> generated Supabase schema.

---

## The Three Governing Rules

### Rule 1 — The generated schema file is GENERATED. Never hand-edit it.

`src/integrations/supabase/types.ts` is machine-generated from the live Supabase
schema. It is the **root of truth** for every table row, insert/update shape, and
database enum. Treat it as read-only:

- Never hand-edit it to add a column, rename a field, tweak an enum, or "fix" a type.
- If the shape is wrong, the fix belongs in a Supabase migration (Lovable's lane),
  after which the file is **regenerated** — never patched by hand.
- The A2 agent is a read-only *steward*: it runs the regeneration, it never edits the
  output.

If a needed table/column/enum does not exist in this file, that is a **schema gap** —
flag it in the "Tracked Product Gaps" section below. Do **not** invent a hand-written
type to paper over the gap.

#### Regeneration + drift gate (Step 8)

Two npm scripts enforce this rule mechanically:

- **`npm run types:gen`** — regenerates `src/integrations/supabase/types.ts` in place.
  Runs `scripts/gen-supabase-types.mjs`, which shells out to
  `supabase gen types typescript --project-id <ref> --schema public`, prepends the fixed
  "GENERATED FILE — DO NOT EDIT" banner, and writes the result. Project ref defaults to the
  linked project and can be overridden with `SUPABASE_PROJECT_ID`. The script refuses to
  write if the CLI errors or its output does not contain `export type Database` (never
  fabricates a passing generation).
- **`npm run types:check`** — the CI staleness gate:
  `node scripts/gen-supabase-types.mjs && git diff --exit-code -- src/integrations/supabase/types.ts`.
  It regenerates, then `git diff --exit-code` exits **0** when the committed file already
  matches a fresh generation and **non-zero** when it is stale (schema drifted, or someone
  hand-edited the file). The banner is a deterministic constant shared by the script and the
  committed file, so an unchanged schema reproduces the file byte-for-byte → no diff.

**Live regeneration requires the Supabase CLI on PATH plus project access
(`SUPABASE_ACCESS_TOKEN` or a linked project).** That environment exists in **CI / Lovable**,
not in the dev worktrees. Per the Step-8 decision, live regen was intentionally **not** run
here — the scripts and banner were verified statically (script syntax, deterministic banner,
graceful non-zero exit + untouched file when the CLI is absent, `git diff --exit-code`
semantics). Wire `npm run types:check` into CI where `SUPABASE_ACCESS_TOKEN` is available so
schema drift fails the build.

### Rule 2 — Every domain type DERIVES from `Database`. No parallel interfaces, no forked enums.

Every domain type is an alias built from the generated `Database` type via the
generated helpers:

```ts
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";

export type Song          = Tables<"songs">;
export type SongInsert    = TablesInsert<"songs">;
export type SongMember    = Tables<"song_members">;
export type SongMemberRole = Enums<"song_member_role">;   // DB enum: owner | collaborator | viewer
export type PlanTier      = Enums<"plan_tier">;           // DB enum: free | pro
```

Prohibited:

- A hand-authored `interface Song { ... }` that duplicates the `songs` row shape.
- A hand-authored union `type Role = "owner" | "collaborator" | "viewer"` that forks
  the `song_member_role` enum instead of aliasing `Enums<"song_member_role">`.
- Any second declaration of a concept that already has a DB-derived alias.

**Type-layer-owned vocabularies (narrow exception).** A few vocabularies are stored in
the DB as a bare `string`/`text` column with no enum, yet have a fixed canonical set the
UI depends on. For these, the type layer OWNS the canonical union and documents it as a
deliberate, DB-un-enumerated vocabulary:

- `SongActivityKind` — activity event kinds (`src/integrations/cog/activity.ts`);
  `activity_log.action_type` / event `kind` is stored as free `string`.
- Canvas `IdeaCardType` / `IdeaCardStatus` (`src/lib/canvas/canvasTypes.ts`).

These are the only permitted hand-authored unions, and only because the DB has no enum
to derive from. They must be documented here, not silently duplicated.

**Display roles (deliberate derived vocabulary).** The DB enum `song_member_role` stores
three roles (`owner | collaborator | viewer`). The UI presents **four**
(`Owner | Contributor | Reviewer | Viewer`). `DisplayRole` is a UI-only vocabulary with a
**documented, lossy** round-trip to the stored enum (see roles table below). This is a
deliberate down-cast, not a fork of the DB enum.

### Rule 3 — Domain types are imported ONLY from `@/types`.

Every feature file **and** every cog function file imports domain types from the
`@/types` barrel (`src/types/index.ts`) — never deep-imports a type from
`@/integrations/cog/*` or `@/integrations/supabase/types` directly.

- `@/integrations/supabase/types` is imported by the **type layer only** (`src/types/**`),
  which re-exports the curated public surface.
- Feature screens, hooks, and cog data-access functions import their types from `@/types`.
- This single import site is enforced by an ESLint `no-restricted-imports` rule
  (added in a later A2 step) so drift is lint-blocked, not merely convention.

Data-access **functions** continue to live in `src/integrations/cog/*` — only their
*type declarations* relocate to `src/types/**`; the function files then import those
types back from `@/types`.

---

## Roles round-trip (canonical)

| UI `DisplayRole` | Stored `SongMemberRole` | Capability copy (verbatim) |
|---|---|---|
| Owner | `owner` | Full control — all permissions. |
| Contributor | `collaborator` | Can add lyrics, memos, comments, and ideas. |
| Reviewer | `collaborator` | Can comment and approve changes. |
| Viewer | `viewer` | Can listen and read. |

- `owner → owner`, `viewer → viewer` are lossless.
- `contributor → collaborator` and `reviewer → collaborator` are **LOSSY**: two UI roles
  collapse to one stored enum value. Reviewer is a **permission flag layered on
  `collaborator`**, not a distinct stored role. The reverse map (`collaborator → ?`)
  cannot recover Reviewer vs Contributor from the enum alone — `dbRoleToDisplay` therefore
  defaults `collaborator → contributor`.

### Single home + reconciliation direction (Step 4)

The canonical source for **every** role artifact — `SongMemberRole`, `DisplayRole`,
`ROLE_DISPLAY` (labels + blurbs), `ROLE_CAPABILITY` (verbatim capability sentences,
derived from `ROLE_DISPLAY`), `ROLE_PERMISSIONS` (human-readable grant summary),
`displayRoleToDb`, `dbRoleToDisplay`, `roleLabel` — is now **`src/types/role.ts`**,
surfaced through the `@/types` barrel.

`src/lib/invite/roles.ts` (built earlier by B3/E1) was the interim home; it is now a
**thin compat re-export shim** that delegates to `@/types/role`, keeping its legacy
names alive (`UiRole = DisplayRole`, `DbRole = SongMemberRole`,
`dbRoleToUi = dbRoleToDisplay`, `uiRoleToDb = displayRoleToDb`, plus `ROLE_DISPLAY`,
`RoleDisplay`, `roleLabel`). Existing importers — `RolePicker`, `RoleBadge`, `PeoplePage`,
`src/lib/permissions/capabilities.ts` — compile unchanged. `src/lib/invite/inviteApi.ts`
likewise now delegates its `dbRoleToUi` / `uiRoleToDb` to the canonical functions
(narrowing `owner → contributor` for the invite-only UI set). `InviteRole` in
`inviteContext.ts` stays a flow-local sessionStorage union (not a competing role
definition). Direction chosen: **canonical-in-types, shims delegate** — least-breaking,
one definition per artifact.

**Enforcement lives elsewhere, deliberately.** The runtime permission GATE (what a role
may *do* in code) is the single boolean matrix `ROLE_CAPABILITIES` in
`src/lib/permissions/capabilities.ts` (E1). `role.ts`'s `ROLE_PERMISSIONS` is a
**display-only** grant summary, not a second gate — do not branch behavior off it.
`role.ts` intentionally does **not** import the permissions layer (that module imports
`@/types/role`; the reverse would be a cycle).

### FILED SCHEMA REQUEST → Lovable: a stored Reviewer role

Until the DB can store Reviewer, the round-trip is lossy and Reviewer is display/flag-only.
**Request:** either add `reviewer` to the `song_member_role` enum, **or** add a
`can_approve boolean` (or `is_reviewer`) column to `song_members`. When shipped, `A2`
tightens `dbRoleToDisplay` to recover Reviewer, and `capabilities.ts` gates `review` off
the real stored value instead of the opt-in `{ reviewer: true }` flag. Owner: Lovable
(schema). Consumers already model `reviewer` (RolePicker "coming soon", capabilities
`resolveEffectiveRole` opt-in), so no frontend churn is needed the day it lands.

---

## Credits vs billing (do not conflate)

Songwriting **Credits** (the contribution ledger — who wrote lyrics, added a memo,
suggested a chord) are **un-modeled in the DB**. `src/pages/CreditsPage.tsx` is a fixture,
and that fixture *is* the current spec. `Credit` / `ContributionType` are **greenfield**
type-layer definitions — mark them clearly as not-yet-persisted.

They must **never** be conflated with the billing `credit_ledger` (money / Stripe /
founder-code value). Different concept, different lane (Lovable/billing).

---

## Tracked Product Gaps (flag to product/Lovable — do not invent a type to hide it)

Each gap below was verified against the real files in this worktree on the date noted.
Per Rule 1, none of these is to be "fixed" by hand-authoring a type; they are schema /
product decisions for product + Lovable.

### Gap A — Mockup activity events with no matching `SongActivityKind` member

`SongActivityKind` (`src/integrations/cog/activity.ts`, lines 25–41) currently enumerates:
`take_committed, capture_created, capture_promoted, memo_uploaded, memo_finalized,
memo_transcribed, invite_accepted, member_left, owner_transferred, card_moved,
card_linked, card_unlinked, card_grouped, card_section_set, card_promoted_final,
card_deleted`.

The Activity-feed mockup (`download (20).webp`, "What changed since you left") shows
events with **no matching kind**:

- **"Parker edited Verse 2"** — a lyric/section edit. No `lyric_edited` / `section_edited`
  kind exists.
- **"Caleb suggested a chord change"** — a line/chord suggestion. No `suggestion_created`
  / `chord_suggested` kind exists.
- **"2 comments need review"** — comments. No `comment_added` / `comment_pending` kind
  exists.

**Flag to product/Lovable — do not invent a type to hide it.** These kinds also depend on
features (comments, line suggestions) whose DB tables are not yet present (see Group D
notes: missing `song_suggestions` table). When the events + tables are decided, the
canonical union grows here.

### Gap B — Pro price discrepancy: $100 (seed) vs $12 (mockup) — STILL PRESENT

The DB/config seed prices Pro at **$100/month**:

- `supabase/migrations/20260603052727_*.sql:21` → `('pro_price_cents', to_jsonb(10000), …)`
- `supabase/functions/_shared/stripe.ts:102` → `if (plan === "pro") return 10000;`

The upgrade mockup screen prices Pro at **$12/month**:

- `src/pages/UpgradePage.tsx:147` → `$12/month`
- (a separate `src/pages/pricing/UpgradePage.tsx:105` cites `$49/month instead of $100`.)

Three different numbers are live ($100 seed, $12 mockup, $49 founder-rate copy).
**Flag to product/Lovable — do not invent a type to hide it.** This is a pricing decision,
not a type fix.

### Gap C — Chord positions live in `song_lyrics.content` JSON; no `chord_positions` table

The planned schema (CLAUDE.md §5) lists a `chord_positions` table
(`lyric_id, chord_name, char_position`). It **does not exist** in the generated types —
`grep chord_position src/integrations/supabase/types.ts` returns nothing.

Instead, `song_lyrics` (`types.ts:1420`) stores `content: Json` alongside `plain_text:
string`. Chord placement is therefore embedded, un-typed, inside the `content` JSON blob —
there is no typed row for a chord position.

**Flag to product/Lovable — do not invent a type to hide it.** Until a `chord_positions`
table (or a typed JSON schema for `content`) is decided, the type layer must not fabricate
a `ChordPosition` row type that implies persistence that does not exist.

### Gap D — `sub_plan` → `plan_tier` coarse mapping is not modeled in the type layer

Two plan axes exist and are kept distinct in `src/types/enums.ts`:
`SubPlan` = `sub_plan` (`free`|`starter`|`pro`|`founder_pro`, billing) and
`EntitlementTier` = `plan_tier` (`free`|`pro`, coarse entitlement). The DB `plan_tier`
enum has **no `starter` member**, so whether a `starter` subscriber resolves to the `free`
or `pro` coarse tier is a **backend decision** — the SQL `plan_tier_key_for_user` returns
the 3-value `plan_tiers.key` (yet another axis), not the `plan_tier` enum.

**Flag to product/Lovable — do not invent the bridge.** The type layer ships `isPro`
(mirrors `is_pro_user` = `pro`|`founder_pro`) and `isPaidPlan` (any non-free), but does NOT
author a `subPlan → EntitlementTier` mapping function, because that would fabricate a
mapping the schema does not pin down.

> Note (naming): the coarse DB enum is exported as **`EntitlementTier`**, not `PlanTier`,
> because a richer `PlanTier` pricing-config OBJECT already exists in `src/types/billing.ts`.
> Two distinct concepts; kept apart on purpose.

### Follow-up — forked `SubPlan` in `src/lib/pricing/pricingApi.ts:13`

`pricingApi.ts` hand-authors `export type SubPlan = 'free' | 'starter' | 'pro' |
'founder_pro'` — a fork of the DB enum. The canonical `SubPlan` now lives in `@/types`
(derives from `Enums<'sub_plan'>`). The Step 10 codemod repoints this import at `@/types`
and deletes the local fork.

---

## Error taxonomy (Step 7)

There is **one** domain error type, homed in `src/types/error.ts` and surfaced through
`@/types`:

- `CogErrorCode` — the canonical union of edge-function codes (`INTERNAL`,
  `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `METHOD_NOT_ALLOWED`, `OFFLINE`,
  `QUOTA_EXCEEDED_SONGS`, `QUOTA_EXCEEDED_STORAGE`, `SONG_NOT_FOUND`, `SONG_DELETED`,
  `NOT_A_MEMBER`, `OWNER_CANNOT_LEAVE`, `NEW_OWNER_NOT_MEMBER`, `TRANSFER_BLOCKED_QUOTA`,
  `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_ALREADY_USED`, `INVITE_EXHAUSTED`).
  `OFFLINE` was added in Step 7.
- `CogErrorCodeLike = CogErrorCode | (string & {})` — the **documented escape hatch**:
  a genuinely-unknown wire code from a newer/older backend still type-checks, while every
  known code autocompletes. `CogError.code` is typed to `CogErrorCodeLike` (tightened from
  the old `CogErrorCode | string`).
- `CogError` — the runtime class every data-access call throws. **Moved here from
  `src/integrations/cog/songs.ts`**; `songs.ts` imports it back from `@/types` and
  re-exports it so `members.ts` / `versions.ts` / `notes.ts` (which import `{ CogError }
  from "./songs"`) keep resolving until the Step 10 codemod.
- `isCogError(err): err is CogError` and `toCogError(err): CogError` — guards. `toCogError`
  coerces any thrown value (a CogError passthrough, a `{code,message}` object such as a
  Supabase/PostgREST error or edge envelope, a bare string, or anything else) into one
  shape defaulting to `INTERNAL`. A3 may adopt `toCogError` to replace the ad-hoc
  `asCogError` helper in `versions.ts`.

**UI RULE (contract):** switch on `error.code`, **never** on `error.message`. Codes are the
contract; messages are display copy and will be reworded without notice.

### Auth taxonomy — DELIBERATELY SEPARATE (decision recorded)

`AuthError` / `AuthErrorCode` in `src/integrations/cog/auth.ts` are **kept separate**, not
folded into `CogError`. Rationale:

- They originate at the **Supabase auth SDK boundary**, not COG edge functions.
- They carry an auth-only field, `retryAfterSeconds` (present on `COOLDOWN` /
  `RATE_LIMITED` / `CEILING`), that has no meaning on a domain error.
- Their code vocabulary is auth-specific (`INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`,
  `WEAK_PASSWORD`, `INVALID_OTP`, `GEO_BLOCKED`, `PHONE_PROVIDER_DISABLED`, …) with no
  overlap with the domain codes.

Merging would blur two boundaries and force an unrelated field onto every domain error.
`AuthError` therefore stays imported from `@/integrations/cog/auth` and is **not** surfaced
through the domain `@/types` barrel. This boundary is intentional, not an oversight.

---

## Change log

- **2026-07-08 (Step 1)** — Contract established. Three governing rules stated; roles
  round-trip, Credits-vs-billing separation, and type-layer-owned vocabularies documented;
  Gaps A/B/C verified against real files and flagged. Linked from `CLAUDE.md`
  (Type-contract law, §0). No code moved yet — Steps 2–10 build `src/types/**`, relocate
  colocated type decls, add the lint rule, and codemod imports to `@/types`.
- **2026-07-08 (Step 7)** — Error taxonomy consolidated. `CogError` class moved from
  `cog/songs.ts` into `src/types/error.ts` (re-exported from `songs.ts` for back-compat);
  `.code` tightened to `CogErrorCodeLike` (known codes + documented `string & {}` escape);
  `OFFLINE` code added; `isCogError` / `toCogError` guards added; UI-switches-on-code rule
  restated. `AuthError`/`AuthErrorCode` decision recorded: kept as a deliberately separate
  auth-boundary taxonomy (not folded, not surfaced through `@/types`). Typecheck: 17
  errors, byte-identical to the Step-6 Group-2 set; zero new.
- **2026-07-08 (Step 8)** — Schema-drift discipline added. New `scripts/gen-supabase-types.mjs`
  + npm scripts `types:gen` (regenerate in place) and `types:check` (regenerate + `git diff
  --exit-code` staleness gate for CI). Fixed "GENERATED FILE — DO NOT EDIT / run npm run
  types:gen" banner added to the top of `src/integrations/supabase/types.ts` and mirrored as a
  deterministic constant in the script. Live regen intentionally NOT run in this worktree (no
  Supabase CLI / project access — that runs in CI/Lovable); verified statically: `node --check`
  passes, banner deterministic, `types:gen` exits non-zero and leaves the file untouched when
  the CLI is absent (no fabricated pass), build green, typecheck still 17 (Group-2 only).
