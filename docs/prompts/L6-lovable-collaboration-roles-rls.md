# L6 — LOVABLE: Collaboration — Members, Invites, Roles & RLS
## Cluster 6 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. Collaboration is the growth loop and the trust boundary at once.
> Backend + the `cog/*` seam only. Songwriter truth: **handing a co-writer your song is
> an act of trust — their role must mean exactly what it says, and an invite must never
> leak the song to the wrong person.**

## YOUR ROLE
Lovable: Supabase schema/RLS, edge functions, the typed `src/integrations/cog/members.ts`
seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Already present: tables `song_members`, `song_invites`, `invite_requests`; edge functions
`song-invite-create` / `song-invite-accept` / `song-invite-preview`; the `members.ts`
seam; and a frictionless join flow (`src/pages/invite/*`). Roles per `CLAUDE.md` §3 and
Product Vision 06/07: **Owner · Contributor · Reviewer · Viewer**. This prompt hardens
and completes the backend so roles truly gate and invites are safe at scale.

## OBJECTIVE
A secure, role-enforced collaboration backend: invites that can't leak or escalate,
roles enforced in RLS across the song and every child table, clean member management,
and a typed seam the UI (C5) consumes.

## TASKS
1. **Role enforcement in RLS (Critical):** `song_members.role` ∈ {owner, contributor,
   reviewer, viewer}. Enforce on the song **and all children** (lyrics, sections, memos,
   takes, transcripts, notes, chords, canvas_cards, activity, versions, credits):
   - Owner: full control incl. destructive ops + member/role management.
   - Contributor: create lyrics/memos/notes/ideas/cards; edit own; no destroy-others.
   - Reviewer: read all + comment/approve; no content mutation.
   - Viewer: read/listen only.
   Tie to L1's RLS matrix; prove deny-by-default.
2. **Invite tokens (secure):** `song_invites` with an **unguessable** token, **expiry**,
   single-use (or capped uses), and the **role baked in**. `song-invite-preview` returns
   only safe public info (song title, inviter, role) — never private content.
3. **Accept flow (idempotent, no escalation):** `song-invite-accept` is auth-checked,
   idempotent (re-accept doesn't duplicate membership), can't grant a higher role than
   the invite specifies, and can't be replayed after expiry/use. Rate-limit create/accept.
4. **Member management:** list members; **owner-only** change-role / remove-member;
   any member can **leave**; **transfer ownership** (owner → another member) safely.
5. **Growth attribution (calm):** record who invited whom for the referral loop
   (Product Vision 14) — coordinate with L10; never spammy, never PII-leaky.
6. **The seam (`members.ts`):** typed `listMembers`, `createInvite(role)`,
   `previewInvite`, `acceptInvite`, `changeRole`, `removeMember`, `leaveSong`,
   `transferOwnership`. Document states + errors for C5.

## DELIVERABLES
1. Role-gated RLS across song + children (matrix updated). 2. Secure invite tokens
   (expiry/single-use/role-bound). 3. Hardened create/accept/preview edge functions.
4. Member management (change-role/remove/leave/transfer). 5. Growth attribution hook.
6. Documented `members.ts` seam.

## ACCEPTANCE CRITERIA
- [ ] A Viewer cannot write; a Contributor cannot destroy others' work; only Owner manages roles — enforced by RLS, not UI.
- [ ] Invite tokens are unguessable, expiring, single-use, role-bound; preview leaks nothing private.
- [ ] Accept is idempotent + escalation-proof; create/accept rate-limited.
- [ ] Member management + ownership transfer work and are owner-gated.
- [ ] One typed `members.ts` seam covers everything C5 needs.

## CONSTRAINTS
Backend + seam only. RLS is the real boundary — never rely on the UI to enforce roles.
Never expose service-role. `lovable/collaboration` → merge → delete.

## REFERENCES
- tables: `song_members`, `song_invites`, `invite_requests`
- `supabase/functions/song-invite-*`, `src/integrations/cog/members.ts`, `src/pages/invite/*`
- Product Vision 06 (Invite Into The Song) + 07 (Simple Roles, Clear Control) PDFs
- `docs/prompts/L1-…schema-consolidation.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §3
