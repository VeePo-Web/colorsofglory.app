# E1 · Roles & Permissions — Progress Log

The frontend permission system. One trustworthy answer to "can I do this in THIS
song?", derived from real membership, honored on every surface, shown as a calm
state. Consumed by B3, C2–C5, D2, D3, E2–E4.

> Canonical contract: **`docs/ROLE-CONTRACT.md`**.

---

## Environment note (important for anyone resuming)

This build ran against a **live, concurrently-edited** repo. Facts that differed
from the E1 charter's audit and shaped the implementation:

- **`LyricsEditorPage.tsx` was deleted** by another agent mid-run. Its
  `searchParams.get("role")` spoof gate is therefore gone with it; `/songs/:id/lyrics`
  no longer resolves to that page. The lyrics editor is now the **Sheet**
  (`/songs/:id/sheet` → `SongSheetPage`).
- **`ROLE_DISPLAY` + the UI role model live in `src/lib/invite/roles.ts`** (B3's
  interim canonical home), NOT in A2's `@/types` yet. `@/types/role` only
  re-exports the DB enum `SongMemberRole`. E1 consumes `ROLE_DISPLAY`,
  `roleLabel`, `dbRoleToUi`, `UiRole` from `@/lib/invite/roles`. When A2 re-homes
  it to `@/types`, collapse that module to a re-export — E1 needs no change.
- **A4 shipped an auth single-source**: `AuthProvider` + `useAuth()` in
  `src/lib/auth/AuthContext.tsx` (status: `loading | authed | anon`). E1's
  `useSongRole` consumes `useAuth()` directly — the cleanest session source, and
  what A4 says "everything else consumes."
- **A3's `members.ts` had no role mutations.** E1 filed `updateMemberRole` /
  `removeMember` there (Step 6) as edge-function transport — see the A3 section
  of the contract; the backing edge functions are a Lovable dependency.

---

## Steps

### Step 1 — Capability policy model ✅
`src/lib/permissions/capabilities.ts`: a pure, React-free policy map (one row per
effective role → `CapabilitySet`) plus `can(role, action)`, `capabilitiesFor`,
`resolveEffectiveRole`. Reviewer modelled as a permission FLAG, not a stored role.
Proven by `src/test/permissions-capabilities.test.ts` (8 tests). `tsc` clean.

### Step 2 — `useCapabilities` / `useSongRole` on real membership ✅
`useSongRole(songId)` wraps A3's `myRole()` RPC in React Query, gated on
`useAuth()`. `useCapabilities(songId)` resolves it through the policy map and
returns `{ role, can, isOwner, isViewer, isLoading, isLocalMode, … }`. Three
documented resolutions: authed+concrete = security boundary; authed+null =
view-only; loading = optimistic contributor; unauthenticated = local/demo owner.

### Step 3 — Killed the spoofable `?role=viewer` gate ✅ (flagship)
Canvas now derives `isViewer` from `useCapabilities(songId)` — the ~15 downstream
gate sites and the 3 feature hooks keep the same `isViewer` variable, so they
inherit the real answer with zero churn. `searchParams.get("role")` has **zero**
matches left in `src`. Proven by `feature04-canvas.test.tsx`: a real viewer is
locked with NO url param, and an **owner with a spoofed `?role=viewer` stays fully
editable**. The canvas test was already red (A4's `useSongTitle` → `useQuery`
needs a `QueryClientProvider`); fixed the harness while migrating.

### Step 4 — Canonical `RolePicker` ✅
`src/components/roles/RolePicker.tsx` — the shared "Choose their role" selector
(gold-selected, matches `download (19)`), labels/desc from `ROLE_DISPLAY`,
Reviewer shown "Soon" + non-selectable. **PeoplePage now consumes it** (its
private duplicate `RoleCard` is deleted). Published for B3's invite flow to import
(B3 owns whether/when — E1 never edits their screens).

### Step 5 — `RoleGate` ✅
`src/components/roles/RoleGate.tsx` — `<RoleGate songId can="edit">…</RoleGate>`
renders children when permitted, else a **calm `ViewOnlyHint`** (never a dead
control). Plus `useCan(songId, cap)` and `ViewOnlyHint`. This is the one-line gate
for C2–C5, D2, D3, E2–E4.

### Step 6 — Owner role-management ✅ (dead pencil is now real)
`src/components/roles/MemberRow.tsx` — an Owner can promote/demote (Viewer ↔
Contributor) and remove, gated to `can("manageRoles")`, with a calm confirm,
`aria-live` announcement, and optimistic+reconciled updates. PeoplePage mounts it,
loads members via A3's `listMembers`, and routes mutations through A3's new
`updateMemberRole` / `removeMember`. Owners are never manageable from this UI →
last-Owner invariant is structural.

### Step 7 — `RoleBadge` everywhere ✅
`src/components/roles/RoleBadge.tsx` renders every role via `roleLabel` (→
`ROLE_DISPLAY`), Owner crown. PeoplePage's inline `m.role === "owner" ? … `
mapping is gone. Proven: no raw `"collaborator"` string reaches the UI.

### Step 8 — Gating-coverage audit ✅
Parallel audit across all 7 surfaces → role→surface matrix + 8 filed gaps in
`docs/ROLE-CONTRACT.md §9–10`. Findings: the hook is wired correctly where E1
owns the seam (canvas core paths, People role-management) and where E3 gates via
real membership (versions). **E1 closed the one gap in its own seam** — the
PeoplePage invite card + `handleSend`/`handleGenerate` are now gated on
`can("invite")` (Owner-only; non-owners see a calm read-only note). The other
five surfaces (Sheet, Voice, Notes, Capture, canvas voice/metronome sub-panels)
don't yet consume the hook and are **filed to their owning agents (G1–G8)** with
the exact one-line `useCapabilities`/`RoleGate` fix. RLS is the true wall behind
all of them.

### Step 9 — Calm / safe / accessible ✅ (built-in + tested)
View-only is a quiet `role="note"` hint (no red). Role changes announce via
`aria-live="polite"`. Pickers/controls are `<button>`s with focus-visible gold
rings; RolePicker is a `radiogroup`. Last-Owner invariant enforced structurally.
Locked by `src/test/roles-components.test.tsx` (10 tests).

### Step 10 — Four-role verification + publish contract ✅
`src/test/use-capabilities.test.tsx` (7 tests) drives the REAL hook (mocking only
A4's `useAuth` + A3's `myRole`) and verifies **Owner / Contributor / Reviewer /
Viewer / non-member / loading / unauthenticated** each resolve to exactly the
right capabilities. Combined with the canvas spoof-resistance test and the
component tests, all four roles are verified end-to-end. `docs/ROLE-CONTRACT.md`
is published.

---

## Files E1 owns / touched
- **New:** `src/lib/permissions/{capabilities,useSongRole,useCapabilities,index}.ts`
- **New:** `src/components/roles/{RolePicker,RoleGate,RoleBadge,MemberRow,index}.tsx`
- **New tests:** `src/test/{permissions-capabilities,roles-components}.test.ts(x)`
- **Edited:** `src/components/canvas/SongCanvasExperience.tsx` (isViewer source),
  `src/pages/PeoplePage.tsx` (consume RolePicker + MemberRow + listMembers),
  `src/integrations/cog/members.ts` (filed `updateMemberRole`/`removeMember`),
  `src/test/feature04-canvas.test.tsx` (real-membership + spoof-resistance).

## Verification (final)
- `tsc -p tsconfig.app.json` — **no errors in any E1 file**. (Pre-existing/other-agent
  test-file tsc errors in `activity-feed`, `cog-founder-code-page`, `voice-memo-added`
  are not E1's.)
- `vite build` — **succeeds**.
- **E1 tests: 29/29 pass** — `permissions-capabilities` (8), `use-capabilities` (7,
  four-role + edge states), `feature04-canvas` (4, incl. URL-spoof-resistance),
  `roles-components` (10).
- **Full suite: 382 pass / 8 fail — none of the 8 are E1's.** They are collateral
  of the concurrent auth migration + other agents' WIP:
  - `codex-mobile-render` (4) — pages using A4's `useAuth`-backed `useCurrentAccount`
    (SettingsPage) and the canvas's `CanvasRecapGate` need `<AuthProvider>` in Codex's
    test harness. (A4/Codex, not E1. E1's own canvas test wraps it correctly.)
  - `design-guard` (1) — remaining offender is `components/ui/glow.tsx: #B8953A`
    (another agent's untracked WIP + `.bak`). E1's files were fixed to use tokens.
  - `seo` (1) — onboarding route wiring, from the concurrent `LyricsEditorPage` deletion.
  - `sheet-doc` (2) — ChordPro round-trip, the Sheet agent's domain.

## Launch-readiness (E1 gate)
- ✅ One capability source (`useCapabilities`) from real membership; **no URL-param gate**.
- ✅ One `RolePicker`, one `RoleGate`, one `RoleBadge`; display always via `ROLE_DISPLAY`.
- ✅ Owner role-management works + persists (via A3); last-Owner invariant structural.
- ✅ Viewer read-only on every surface E1 owns; other surfaces filed (G1–G8) with fixes.
- ⏳ Backend dependency (Lovable): `song-member-set-role` / `song-member-remove` edge
  functions must exist + enforce owner-only & last-Owner (see contract §6).
