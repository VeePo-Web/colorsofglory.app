# COG Role Contract (E1)

**The single source of truth for "what can THIS person do in THIS song."**
Every gated surface imports from here. RLS is the real trust boundary (Lovable);
this is the UX boundary that must agree with it.

- Policy + hooks: `src/lib/permissions/*`
- Shared components: `src/components/roles/*`
- Consumed by: B3 (invite), C2–C5, D2, D3, E2, E3, E4.

---

## 1. The role model (law — from A2 / GROUP-A-OVERVIEW §D2)

| Layer | Values |
|---|---|
| **DB storage enum** `SongMemberRole` | `owner` \| `collaborator` \| `viewer` |
| **UI / effective role** `UiRole` = `EffectiveRole` | `owner` \| `contributor` \| `reviewer` \| `viewer` |

Mapping: `collaborator ⇄ contributor`. **`reviewer` is a permission FLAG, not a
stored role**, until Lovable adds an enum value / a `can_approve` boolean. E1
models it as an effective role a member holds via that flag, so `review` gating
is ready the day it ships — no consumer changes.

**Where the model lives today:** `ROLE_DISPLAY`, `roleLabel`, `dbRoleToUi`,
`uiRoleToDb`, `UiRole` are in **`src/lib/invite/roles.ts`** (B3's interim
canonical home). `@/types/role` re-exports the DB enum `SongMemberRole`. E1
consumes both; it never redefines roles. When A2 re-homes `ROLE_DISPLAY` to
`@/types`, collapse `invite/roles.ts` to a re-export — E1 needs no change.

---

## 2. Capabilities (the policy)

`src/lib/permissions/capabilities.ts` — pure, React-free, unit-tested.

| Capability | owner | contributor | reviewer | viewer |
|---|:---:|:---:|:---:|:---:|
| `view` | ✅ | ✅ | ✅ | ✅ |
| `edit` (lyrics/chords/notes/canvas/arrange) | ✅ | ✅ | — | — |
| `record` (voice memos / hums) | ✅ | ✅ | — | — |
| `suggest` (line suggestion / comment) | ✅ | ✅ | ✅ | — |
| `review` (approve/reject a suggestion) | ✅ | — | ✅ | — |
| `invite` | ✅ | — | — | — |
| `manageRoles` (promote/demote) | ✅ | — | — | — |
| `removeMember` | ✅ | — | — | — |
| `editMeta` (title/key/BPM/dedication) | ✅ | — | — | — |
| `deleteSong` (archive/delete) | ✅ | — | — | — |

`can(role, action)` is pure; a `null`/unknown role can do nothing.

---

## 3. The hooks

### `useSongRole(songId) → { role, status, isLoading, isUnauthenticated }`
Real membership from A3's `myRole()` RPC via React Query (`["song", id, "my-role"]`),
gated on A4's `useAuth()`. `status`: `loading | unauthenticated | authenticated`.

### `useCapabilities(songId, { reviewer? }) → Capabilities`
The one hook every feature imports.
```ts
const caps = useCapabilities(songId);
caps.can("edit"); caps.isViewer; caps.isOwner; caps.isLoading; caps.isLocalMode;
```

**Resolution (the three non-obvious cases):**

1. **Authenticated + concrete role** → the **security boundary**. A real
   `viewer` is read-only; a real owner/contributor gets their caps. **Editing
   the URL grants nothing** — role comes from the server.
2. **Authenticated + `null` role (not a member)** → **view-only** (`isViewer`).
3. **Loading** → optimistic **contributor** caps (creative surface stays open, no
   flash-lock; owner-admin actions stay closed until confirmed).
   **Unauthenticated** (onboarding / local-demo, e.g. `songId "1"` on
   localStorage) → **local owner** caps: there is no server identity to gate, and
   RLS is the wall for any real write. Preserves onboarding + the demo canvas.

The harsh "View only" lockout shows **only** for a confirmed viewer / non-member
(`isViewer`) — never during loading, never in demo mode. View-only is a calm
state, not an error.

---

## 4. The components (`src/components/roles`)

- **`<RolePicker value onChange roles? layout? />`** — canonical "Choose their
  role" selector. Gold-selected (matches `download (19)`); Reviewer shown "Soon"
  and non-selectable. Consumed by PeoplePage; **published for B3's invite flow**.
- **`<RoleGate songId can="edit" fallback? silent?>…</RoleGate>`** + **`useCan(songId, cap)`**
  — the declarative one-line gate. Denied → calm `<ViewOnlyHint/>` (or `silent`).
- **`<RoleBadge role />`** — every role label; `roleLabel` + Owner crown. No raw
  enum ever reaches the UI.
- **`<MemberRow member canManage onSetRole onRemove />`** — an Owner's
  promote/demote/remove row. Owners are never manageable here → last-Owner
  invariant is structural. Mutations route through A3 (§6).

**For a feature agent:** gate a control in one line —
```tsx
<RoleGate songId={songId} can="record"><RecordButton/></RoleGate>
// or, to disable in place:
const canEdit = useCan(songId, "edit");  <button disabled={!canEdit}/>
```

---

## 5. What E1 consumes from A2

- `SongMemberRole` (DB enum) from `@/types/role`.
- `ROLE_DISPLAY`, `roleLabel`, `dbRoleToUi`, `UiRole` from `@/lib/invite/roles`
  (interim home; re-home to `@/types` later — E1 unaffected).

## 6. What E1 consumes from / filed with A3 (`src/integrations/cog/members.ts`)

Consumed: `myRole(songId)`, `listMembers(songId)`.

**Filed by E1 (Step 6)** — member-mutation transport, added to `members.ts`:
```ts
updateMemberRole(songId, userId, role): Promise<void>   // edge fn: song-member-set-role
removeMember(songId, userId): Promise<void>             // edge fn: song-member-remove
```
These call edge functions via the canonical `call()` wrapper. **Backend
dependency (Lovable):** the `song-member-set-role` / `song-member-remove` edge
functions must exist and enforce, server-side: owner-only, the **last-Owner
invariant**, and return the standard `{ ok, code }` envelope (`FORBIDDEN` for a
non-owner). Until deployed, the calls surface a `CogError` and the UI rolls back
calmly — the UI is fully wired and correct ahead of the backend.

## 7. What E1 consumes from A4

- `useAuth()` / `AuthProvider` (`src/lib/auth/AuthContext.tsx`) — the single
  session source (`status: loading | authed | anon`).
- The shared `queryClient` (via `@/lib/queryClient`).

---

## 8. Security property (verified)

Role can no longer be set from the URL. `searchParams.get("role")` has **zero**
matches in `src`. Verified by `feature04-canvas.test.tsx`: a confirmed viewer is
read-only with no URL param, and an **owner with `?role=viewer` in the URL keeps
full edit rights**. RLS remains the real wall; this client gate agrees with it.

---

## 9. Role → surface capability matrix

_From the Step 8 gating-coverage audit (7 surfaces). "Gate source" = where the
edit/record block comes from. A confirmed Viewer / non-member must be read-only._

| Surface | Mutating actions | Required cap | Gate source | Viewer read-only today? |
|---|---|---|---|---|
| **Canvas** — add/record/merge/compare/final-arrange | `edit`, `record` | `useCapabilities.isViewer` | **real membership ✅** | Yes (core paths) |
| **Canvas** — voice panel upload/delete, metronome BPM | `record`, `edit`, `editMeta` | none | ❌ ungated | **No — gap (G1,G2)** |
| **Canvas** — listen-path save, card drag | `edit` | none (localStorage only) | ❌ ungated | No — gap, low (G3) |
| **Sheet** (lyrics + chords) | `edit` (all) | none | ❌ ungated | **No — gap (G4)** |
| **Voice Memos** page | `record`, `edit` | none | ❌ ungated | **No — gap (G5)** |
| **Notes** | `edit` | authorship only (`mine`) | ❌ not role | **No — gap (G6)** |
| **Capture** | `record`, `edit` | none (URL songId) | ❌ ungated | **No — gap (G7)** |
| **People** — invite / share-link / revoke | `invite` | `caps.can('invite')` | **real membership ✅ (E1)** | Yes |
| **People** — promote/demote/remove | `manageRoles`,`removeMember` | `caps.can('manageRoles')` | **real membership ✅ (E1)** | Yes |
| **Version History** — save/restore/undo | `edit` | `useVersionCapabilities`→myRole | real membership ✅ (parallel hook) | Yes (consolidate → G8) |
| **Activity feed** | per-viewer last-seen only | — | n/a (read-only) | Yes |
| **Credits** | none (mock/inert) | — | n/a | Yes |

**Verdict:** the capability system is wired correctly where E1 owns the seam
(canvas core, People invite + role-management) and where E3 gates via real
membership (versions). Five surfaces do not yet consume the hook (Sheet, Voice,
Notes, Capture, + the canvas voice/metronome sub-panels) and lean on RLS alone —
filed below. RLS remains the true server-side wall; these are client-side
defense-in-depth + honest-UX gaps the owning agents close with `RoleGate`/`useCan`.

## 10. Open gaps filed to owning agents

Each surface below imports **`useCapabilities(songId)`** (or wraps controls in
**`<RoleGate songId can="…">`**) and blocks its write path for a confirmed
Viewer. The one-line fix pattern:
```tsx
const { can } = useCapabilities(songId);
// hide/disable: disabled={!can("edit")}  OR  <RoleGate songId can="edit">…</RoleGate>
// and guard the handler: if (!can("edit")) return;
```

| # | Sev | Surface / file | Gap | Owner | Fix |
|---|---|---|---|---|---|
| **G1** | High | `components/voice/VoiceLayerPanel.tsx` (canvas voice panel) | Viewer can **upload** + **delete** voice memos (`saveMemoDurable`, `deleteMemo`) — no role check | Voice / D | Gate record button + UploadDropZone on `can("record")`; delete on `can("edit")`. Thread from canvas `isViewer`. |
| **G2** | High | `lib/canvas/features/useCanvasMetronome.ts` (`songTempo.ts`) | Viewer can change BPM → `persistSongTempo` writes `songs.tempo_bpm` (metadata) | Canvas / D | Guard `setBpm`'s persist behind `can("editMeta")`; local audition allowed, never persist. |
| **G3** | Low | `lib/canvas/features/useListenPath.ts`; canvas card drag (`SongCanvasExperience.tsx:952`) | Ungated saves — **localStorage only today**, becomes a Viewer-write the moment the seam moves to backend | Canvas / D | Thread `isViewer` (mirror `useMergeSplice`) and no-op `save()`/`handleCardMove` for viewers. |
| **G4** | High | `pages/SongSheetPage.tsx` (+ `lib/sheet/useSongSheet.ts`, `integrations/cog/sheet.ts`) | **Zero gating** — Viewer gets the full lyrics/chords editor; every op autosaves via `saveSongSheet`. No `useCapabilities` anywhere. | Sheet / C | `useCapabilities(songId)`; gate all mutating handlers + controls on `can("edit")`; read-only affordance when `isViewer`. |
| **G5** | High | `pages/VoiceMemosPage.tsx` | **Zero gating** — Viewer can record/upload/delete/retry memos | Voice / C | Gate record/upload/delete/retry on `can("record")`/`can("edit")`. |
| **G6** | High | `pages/NotesPage.tsx` (+ `SongNoteCard`) | Add-note ungated (online **and** offline enqueue/flush); edit/delete gated by **authorship, not role** → a demoted member keeps write on old notes | Notes / C5 | Gate compose+save on `can("edit")`; set `canEdit = mine && can("edit")`. |
| **G7** | High | `components/capture/CaptureScene.tsx`, `ReviewSheet.tsx`, `pages/CapturePage.tsx` | **Zero gating** — Viewer can record, transcribe, and **commit lyrics/chords into the song** for a URL-supplied `songId`; route is `RequireAuth` only (auth, not membership) | Capture | Resolve `useCapabilities(URL songId)`; gate record on `can("record")`, commit/transcribe on `can("edit")`; block/read-only for non-members. |
| **G8** | Low | `components/versions/useSongVersions.ts` (`useVersionCapabilities`) | Version gating is correct but uses a **parallel** myRole hook, not E1's — no reviewer/loading/local-mode semantics; invisible-write in demo mode | E3 | Collapse `useVersionCapabilities` onto `useCapabilities(songId)`; derive `canSave/canRestore` from `can("edit")`. |

**Notes:**
- **RLS is the real wall.** Every gap above is only a real *escalation* if the
  server-side RLS for that table/edge-fn is also permissive. These fixes make the
  client honest and agree with RLS; they do not replace it. Lovable must ensure
  RLS + the `song-member-set-role` / `song-member-remove` edge functions (§6)
  enforce owner-only and the last-Owner invariant.
- **Visual-only leaks (not security):** canvas `→ Final` / `← Ideas` card buttons
  render for a Viewer but the write is blocked in the hook; the line-suggestion
  review/accept branch isn't yet tied to a real `review` capability (Viewer can't
  reach it today). Cosmetic — fold into G-canvas cleanup.
