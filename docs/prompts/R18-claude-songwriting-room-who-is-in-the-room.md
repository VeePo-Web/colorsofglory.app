# R18 — Songwriting Room Audit: "Who's in the room"

**Goal of this pass:** the People page answers three questions in one glance —
who is here, what they can do, and who hasn't accepted yet. Nothing else.

## Backend shipped (Lovable)

SDK: `src/integrations/cog/members.ts`

| Function | Purpose |
|---|---|
| `getPeopleBoard(songId)` | One request: `my_role`, `can_manage`, `members[]`, `pending_invites[]` |
| `setMemberRole(songId, userId, 'collaborator' \| 'viewer')` | Owner only |
| `removeMember(songId, userId)` | Owner removes others; anyone removes themselves |
| `revokeInvite(inviteId)` | Owner cancels a pending invite |

`members[]` rows include: `display_name`, `first_name`, `initials`, `avatar_url`,
`avatar_color`, `role`, `joined_at`, `is_me`, `last_seen_at`, `contribution_count`.
`pending_invites[]` is empty for non-owners (never render an empty "Pending" header).

Guardrails enforced server-side (do not re-implement in UI, just surface errors):
- owner role can never be reassigned, changed, or removed (`cannot_change_owner`, `cannot_remove_owner`, `cannot_assign_owner`)
- non-owners calling manage actions get `owner_only`
- every change writes to the song activity feed (`member_role_changed`, `member_removed`, `member_left`, `invite_revoked`)

## UI brief

### 1. People list (single scroll, no tabs)
- Section A: **In this song** — one row per member.
  - Left: avatar (fallback = `avatar_color` circle + `initials`).
  - Line 1: name (append " · You" when `is_me`).
  - Line 2, quiet warm-gray, one line only: role word + `last_seen_at` relative
    ("Collaborator · here 2h ago"), or "Collaborator · hasn't opened it yet" when null.
  - Right: chevron only if `can_manage && role !== 'owner'`; owner rows are static.
- Section B: **Waiting to accept** — only when `pending_invites.length > 0`.
  Row shows masked email/phone, role, and "Sent 3d ago". Trailing "Cancel" text button.

### 2. Role change sheet (owner tapping a member row)
- Two options only: **Collaborator** ("can add lyrics, memos and notes") and
  **Viewer** ("can listen and read"). Selected option carries the gold border.
- Third destructive row at the bottom: "Remove from song".
- Optimistic update + `sonner` toast. On error, revert and show the plain-English
  message. Do not open a confirm dialog for role changes — only for removal.

### 3. Removal
- Confirm sheet: "Remove {name}? They keep their credit for what they've already
  added." Confirm button is destructive, cancel is ghost.
- Self-removal ("Leave this song") lives in the member's own row menu and routes
  back to the catalog after success.

### 4. Contribution signal (keep it tiny)
- `contribution_count > 0` renders a gold dot + count as a right-aligned chip only
  on the People page. Never a red badge, never elsewhere.

### 5. Performance
- Single `getPeopleBoard` query keyed `['people-board', songId]`, `staleTime: 30s`.
- Mutations invalidate that key plus the activity feed key. No refetch storms.
- The page must render from cache instantly on second visit.

## Definition of done
- One request populates the whole page.
- Owner-only affordances are invisible (not disabled) for non-owners.
- Every mutation is optimistic, reversible on error, and shows a calm toast.
- No tabs, no counters in the header, no red.
