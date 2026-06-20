# C5 — CLAUDE: Collaboration UI (Invite + Roles + People)
## Cluster 6 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. Inviting a co-writer is the most emotional moment in the app —
> and the growth loop. Make it two taps and beautiful. Mobile-first; tokens only; seam
> only; meet `MOBILE-UX-BENCHMARK.md`. Songwriter truth: **bringing someone into your
> song should feel like opening a door, not filling a form.**

## YOUR ROLE
Claude: all `src/` UI. Seam only (`cog/members.ts`); no schema/auth-logic/tests.
`docs/BUILD-PATHWAY.md`.

## CONTEXT
Backend (L6) provides members/invites/roles via `members.ts`. The frictionless invitee
join flow exists (`src/pages/invite/*`). What's needed: the **in-app, from-the-song**
invite + role experience and the people roster. Spec + images:
- Product Vision 06 (Invite Into The Song) + 07 (Simple Roles, Clear Control) + 08a
  (Contributor Color Personality) PDFs.
- `download.png` ("Invite someone into this song" + "You've been invited"),
  `download (19).webp` ("Choose their role": Viewer / Contributor (selected, gold) /
  Reviewer + "Confirm role"), `download (21).webp` (credits/people with roles).
- Components: `src/components/invite/*`, `src/components/cog/SongCanvasCollabLayers.tsx`.

## OBJECTIVE
A two-tap invite, a crystal-clear role picker, and a calm people roster where each
collaborator carries their **own color** that threads through their contributions.

## PHASE 0 — SPEC
Read Vision 06/07/08a + the images. The one moment: *tap "Invite", pick a role in plain
language, share the link — done; and later, see your team and what each color means.*

## PHASE 2 — AUDIT (7 lenses)
Audit `src/components/invite/*` + the people layer vs the mockups + benchmark: invite
friction, role clarity, color identity, roster, pending invites, empty state, a11y.

## PHASE 4 — BUILD
1. **Invite sheet (from the song):** "Invite someone into this song" → share link
   (native share / copy) with a chosen role. Two taps max. Warm copy, gold CTA.
2. **Role picker (`download (19).webp`):** the four roles in **plain language** with a
   one-line "what they can do" each (Owner/Contributor/Reviewer/Viewer); selected role
   gets the gold border; "Confirm role". No jargon.
3. **People roster:** members with avatar, name, **role chip**, and their **color dot**;
   pending invites shown calmly; owner sees change-role / remove (via seam, owner-gated
   in backend); "leave song" for non-owners.
4. **Contributor color identity (Vision 08a):** assign/show each collaborator's color;
   ensure it's the same color the canvas/cards/activity use for that person.
5. **Invitee landing polish:** connect/refine the existing join flow so accepting feels
   like arriving in the room (reuse `src/pages/invite/*`).
6. Mobile-first: 44×44, reduced-motion, tokens, calm motion, designed empty state
   ("It's just you in here — invite a co-writer").

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: invite→pick role→share, roster, change-role,
leave, empty. Evidence + a mobile re-drive of the invite + role screens.

## ACCEPTANCE CRITERIA
- [ ] Invite is ≤2 taps; role picker is plain-language with gold-selected state.
- [ ] Roster shows members + roles + per-person color; pending invites calm.
- [ ] Owner-only controls call the seam (backend enforces); non-owner can leave.
- [ ] Contributor color is consistent with canvas/activity; meets the mobile benchmark.
- [ ] ≤250 lines/component; `tsc`+`build`+tests green; 7-lens pass.

## DEPENDENCIES
- **L6** (`members.ts` seam: list/invite/preview/accept/changeRole/remove/leave/transfer).
  Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/collaboration-ui` → merge → delete.
Never enforce roles in the UI alone — the backend (L6) is the boundary; the UI just reflects it.

## REFERENCES
- `src/components/invite/*`, `src/pages/invite/*`, `src/components/cog/SongCanvasCollabLayers.tsx`, `src/integrations/cog/members.ts`
- Vision 06/07/08a PDFs + `download.png`, `download (19).webp`, `download (21).webp`
- `docs/prompts/L6-…collaboration-roles-rls.md`, `MOBILE-UX-BENCHMARK.md`, `BUILD-PATHWAY.md`
