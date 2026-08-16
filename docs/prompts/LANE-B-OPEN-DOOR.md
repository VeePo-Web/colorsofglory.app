# LANE B — THE OPEN DOOR: inviting someone into the song, so simple an 8-year-old can do it

You are a worldclass UI/UX engineer (Fantasy.co × Apple craft, Church Center warmth)
working the Colors of Glory songwriting app (React 18 + Vite + TS strict, Tailwind, COG
design tokens `var(--cog-*)`, mobile-first at 390px iPhone / iOS Safari). You own THIS
lane; a second session is working the capture→canvas lane simultaneously in this same
tree — respect the fences below.

## THE MISSION (the user's words)
"The app doesn't really work. The UI is buggy, lots of visual bugs, the UX flow is not
smooth at all. This is NOT a full re-haul — streamline it so it is extremely simple. So
simple an 8-year-old kid can figure out how to invite people into a song." Collaboration
is the growth loop: every invite is an acquisition event, and the invited person's first
minute decides everything.

## THE LAWS
1. **The 8-year-old test, BOTH directions** — (a) the OWNER: from inside a song, getting
   a co-writer in must be ≤2 obvious taps to a share action; (b) the INVITED: tapping the
   link must land them INSIDE the song room, seeing the song, knowing what they can do —
   with the least possible friction in between (phone-first, Church Center simplicity).
2. **TEMU momentum** — after inviting: what to do while you wait (keep writing; you'll
   hear when they arrive). After accepting: the next act is standing there (listen to the
   idea, add yours). Never a dead stop, never a form wall.
3. **ONE bold thing** — one dominant element per screen. Gold = the single primary act.
   No competing CTAs on the invite or acceptance surfaces.
4. **Calm sanctuary tone** — no urgency, no spam, no red. Plain-language roles
   ("They can add ideas" — never "Contributor permissions"). A worship co-write, not a
   SaaS seat assignment.
5. **Streamline, don't rebuild** — fix, trim, clarify. Frontend only: never touch
   Supabase schema/RLS/edge-function source or auth provider config (file backend gaps
   instead). The OTP/login SCREENS belong to onboarding — you may smooth the seam INTO
   them, not rebuild them.
6. **Evidence before claims** — `npx tsc --noEmit` clean + `npx vite build` green +
   focused `npx vitest run` green before ANY "done". Root causes, never symptoms.

## PHASE 0 — AUDIT THE REAL PATH FIRST (no fixes until this map exists)
No pre-diagnosed ledger exists for this lane — build it. Trace and DOCUMENT with
file:line, as the user, on a 390px viewport:

1. **The owner's path:** song canvas header → Invite chip (`SongCanvasExperience.tsx`,
   ShareSheet region) → what opens? Count taps to a sent invite. What does the share
   sheet actually offer (link? phone? role picker?) and does each control work? What
   confirms the invite went out, and what does the owner see while waiting?
2. **The invited path:** the `/invite/:token` route (find it in `src/App.tsx` +
   `src/pages/**`, `src/components/invite/**`, `src/lib/invite/**`) → open it logged-out
   AND logged-in (trace both branches in code). Where does sign-in interrupt? Does the
   token survive the auth round-trip? Where do they LAND after accepting — the song room,
   or somewhere confusing? What tells them what they can do (role clarity)?
3. **The loop closing:** when the invitee lands in the song, does the owner learn of it
   (presence, arrival moment)? Does the invitee see the owner's ideas immediately
   (hydration works logged-in-fresh)?
4. **Visual bug sweep** of every surface in this path at 390px: ShareSheet, role
   selection, invite page states (valid/expired/used token, loading, error), collaborator
   list, presence stack. Overflow, alignment, z-index, contrast, safe-area, animation
   jank — list them all with file:line.

Classify every finding: BROKEN (with the failing line) / CONFUSING (why, per the
8-year-old test) / VISUAL BUG / WORKS. Then fix in severity order.

## THE TARGET SHAPE (measure the audit against this — reshape only where it falls short)
- **Owner:** Invite (one chip, already in the header) → ONE sheet: who gets in and how
  ("Text them a link" as the hero action; role as a simple human sentence, Contributor
  default) → sent → a calm "the door is open" state + back to writing. ≤2 taps to the
  share action, ≤1 decision (role) with a sane default.
- **Invited:** link → a warm landing that shows THE SONG'S NAME and who's asking
  ("Sarah invited you into 'Grace in the Waiting'") → the least-friction entry the
  existing auth allows (phone-first) → straight INTO the song room → one gentle line
  saying what they can do → the song itself is the next act (hear the latest idea).
- **Both ends of the loop confirmed:** the owner hears when someone arrives; the
  arrival hears where they are.

## LANE FENCES (a second session runs simultaneously)
YOURS: `src/components/invite/**`, `src/lib/invite/**`, the `/invite/:token` page(s),
share-sheet component(s), collaborator/role/presence UI, and ONLY the
ShareSheet/presence/invite region of `src/components/canvas/SongCanvasExperience.tsx`.
NOT YOURS: `src/components/canvas/feed/**`, `src/components/voice/**`, capture,
`src/lib/canvas/**`, `src/lib/voice/**`, `src/hooks/useStackPlayer.ts` (the other lane
is actively editing these — do not touch), `supabase/**`, auth/OTP screen internals.
If a fix genuinely requires the other lane's files, FILE it in your report instead.

## SHIP PROTOCOL (Concurrent-Tree — mandatory every pass)
`git branch --show-current` must be `main` before commit AND push · stage ONLY your files
by path (never `git add -A`; never touch `.agents/`, `tmp/`, others' `docs/prompts/*`) ·
commit with a real message ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ·
`git -c core.autocrlf=false pull --rebase origin main` · push · if the tree holds changes
you didn't make, stash-protect them, never absorb. Re-firable loop: each pass = audit/fix
→ verify → commit+push → report what an 8-year-old would still stumble on → name the next
slice. Do not stop until both directions of the door pass the walkthrough end to end.
