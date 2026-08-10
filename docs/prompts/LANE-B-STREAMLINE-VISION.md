# LANE B VISION — ONE DOOR
## The invite flow, rebuilt by subtraction. Do less. Do it better.

> Grounded in the full four-lens audit of 2026-08-09 (53 findings, 7 adversarially
> confirmed P0/P1). Every claim below has a file:line behind it.

---

## 0 · THE NORTH STAR

A song has **one door**. The owner opens it with one gesture. The friend walks
through it in one breath. The room itself does the welcoming.

The two sentences the entire lane must reduce to:

- **Owner:** *Tap Invite. Tap Send. Back to the song — you'll hear when they arrive.*
- **Invited:** *Tap the link. See the song. One code. You're in the room.*

Everything that is not one of those two sentences is fat.

---

## 1 · WHAT THE FLOW IS TODAY (the fat, measured)

| Dimension | Today | Verdict |
|---|---|---|
| Owner invite flows | **2 divergent universes** — canvas ShareSongSheet (link-first, 2 taps) AND PeoplePage (contact form + 3-card RolePicker with a disabled "Reviewer — Soon" card + a gold "Send invite" that calls an edge function **that does not exist**) | One door has two handles; one of them is painted on |
| Ways to share on the sheet | **3** — gold Copy + "Share…" + tappable link row | Three buttons, one act |
| Screens between link-tap and the room (new user) | **5** — Join → Verify → Name → *Team intro (2.2s auto-advance comet bar)* → canvas | The lobby repeats what the doorstep already said |
| Screens for a recognized user on a new device | **5** — Join → *Welcome-back* → Verify → *Name (blank, overwrites their real name)* → *Team intro* → canvas | We greet them, then forget who they are |
| Signed-in friend tapping the link | **∞ — BROKEN.** RLS hides the invite row from `previewInvite`'s direct table read → "This invite link isn't valid" | The warmest user hits a locked door |
| The landing card in production | "Untitled Song — Someone invited you to collaborate", no faces, no lyrics | RLS blocks anon enrichment; the sell is empty |
| Dead/expired link | **Fake success** — `acceptInvite` never reads the RPC's `code` column; the invitee burns an OTP and lands in a song they were never added to | The door pretends to open |
| Owner hearing the arrival | Only if standing in the room at that minute — the live accept path calls the raw RPC, skipping the edge function that writes the activity event + sends the "someone joined" email | The growth loop's payoff never fires |
| Orphaned chrome | `FirstActionSheet`, `PhotoBanner` — built, imported nowhere; dead `requestNewInvite` duplicate; dead "Edit role" pencil; `fetchPendingInvites`/`getPeopleBoard` with zero callers | Furniture nobody sits on |
| Golds on screen | **2** — pages hardcode `#B5935A`, tokens say `#B8953A` (`var(--cog-gold)`), rendered side by side | Two golds is no gold |
| Error languages | **2** — red `#E05440` on the invited side, muted terracotta `#B4543F` on the owner side | Red in a sanctuary |
| Live links per song | **+1 unrevokable 10-use token every time the sheet opens** | Confetti keys, no lock |

The lesson of the audit: **the complexity is not decoration on a working flow —
the complexity is where the breakage hides.** Two accept paths meant one was
never wired to the loop. Two preview paths meant the real one was never
RLS-tested. Two invite universes meant one shipped against a phantom backend.
Subtraction is the bug fix.

---

## 2 · THE PHILOSOPHY CUTS (what dies, and why)

Jobs' question is never "is this useful?" — it is "is this **necessary**?"

1. **The second invite universe dies.** PeoplePage's contact-form + RolePicker +
   "Send invite" path is deleted (its backend does not exist; its green success
   state is unreachable code). PeoplePage becomes what its name says: the people.
   A roster, and one gold **Invite** that opens the *same* ShareSongSheet as the
   canvas. One door, one handle, everywhere. (`RolePicker` is deleted with it if
   no other caller remains.)

2. **The lobby dies.** `InviteTeamIntroPage` — the 2.2s auto-advancing "who's
   already here" interstitial — is deleted. The join landing *already* shows the
   faces and names before the decision. Auto-advance comet bars are Vegas, not
   Apple. After acceptance you are **in the room**, and the room greets you.

3. **The greeter dies.** `InviteWelcomeBackPage` is deleted as a screen; its two
   real behaviors (session-match → instant accept; otherwise send OTP) fold into
   the join page's "Continue as Parker →" button. A recognized person should not
   be walked to a second podium to be recognized again.

4. **Three share buttons become one act.** On phones with `navigator.share`, the
   hero is **one gold "Send the link"** — the native sheet already offers
   Messages, WhatsApp, copy. Where share doesn't exist, the hero is **Copy**.
   The link row remains as the quiet always-there fallback. The separate
   "Share…" secondary is deleted.

5. **The sheet does one job.** "Jump to a person's latest idea" leaves the
   invite sheet (presence-as-navigation belongs to the header stack it came
   from). The roster stays — as the quiet answer to "who can already get in" —
   but it is furniture, not controls.

6. **The confetti keys become one key.** Opening the sheet reuses the song's
   existing valid invite link for that role instead of minting a fresh 10-use
   token per open. The link becomes a stable object — a door key you can hand
   out twice and later change — not an accumulating pile of unlisted doors.

7. **The orphans die.** `FirstActionSheet`, `PhotoBanner`, the dead
   `requestNewInvite` duplicate, the dead "Edit role" pencil (a control that
   does nothing does not ship), the unreachable "Invite sent — we texted…"
   state. The arrival moment keeps exactly **one** voice: the RoleToast — one
   gentle line about what you can do — and then the song itself is the welcome.

8. **One question survives per person.** Phone (who are you reaching), Code
   (prove it), Name (what do we call you — new users only, once, never
   overwriting an existing name). Each earns its place. Nothing else is asked.

What we do **not** cut: the role toggle (one defaulted, plainly-worded
decision is the lane's law), the name question (credits and presence are the
product's soul), the blurred-lyrics tease, the real-data-only scarcity line,
the "Joining a song never uses anyone's free song" reassurance. Essential is
not fat.

---

## 3 · THE TARGET EXPERIENCE

### The owner (unchanged where already excellent, finished where it stops short)

1. In the room: header pill — avatars + **Invite**. *(exists, works, 3-second
   discoverable — untouched)*
2. Tap 1: the sheet rises. The link is already made (reused, stable).
3. Tap 2: **Send the link** → native share (or Copy where share doesn't exist).
4. The sheet acknowledges and **leaves**: the button flips green, one line
   appears — *"The door is open. Keep writing — you'll hear when they arrive."*
   — and the sheet dismisses itself back to the song. No dead stop, no lingering
   modal, no second decision.

Two taps. One optional decision. Then back to writing — with a **true** promise,
because Phase 1 makes arrival actually reach the owner (activity event + email
via the real accept path, roster that refreshes, presence toast when in the room).

### The invited — three people, one door

**A friend already signed in** *(today: broken)*
Link → the song's name, the inviter's name, the faces → one gold tap
**"Join as Sarah →"** → **the room.** One screen. One tap.

**A friend the app knows, on a new phone** *(today: 5 screens + name wipe)*
Link → landing recognizes her number → "Continue as Parker →" → code → **the
room.** Her name is never asked again, never overwritten.

**A brand-new person** *(today: 5 screens)*
Link → landing (song, inviter, faces, blurred lyric tease) → phone → code →
"What's your name?" → **the room.** Three questions, zero interstitials.

**The arrival, for all three:** the canvas opens on the owner's real song (no
empty-room flash), the RoleToast says the one line — *"You can write lyrics,
add voice memos, and comment"* — clear of the creation dock, once, never on
reload. The latest idea is right there. The song does the welcoming.

### The loop, closed at both ends

- Owner in the room → live presence toast: *"Sarah joined the room."* *(works today)*
- Owner anywhere else → the accept writes the real `invite_accepted` activity
  event and triggers the "someone stepped into your song" email *(today: never
  fires — fixed by using the deployed edge function)*.
- The roster and avatar stack reflect the new member without a remount.

---

## 4 · WHAT STAYS EXACTLY AS IT IS (the audit's WORKS list)

- Header invite pill: gold register, 44px, one-bold-thing discipline with "Review N".
- Pre-generated link + synchronous clipboard write inside the tap (iOS Safari gesture guard).
- Accept-before-name ordering (an abandoned name screen can never lose the membership).
- Token continuity: sessionStorage context surviving refresh; main-auth detours bridged back.
- OTP screen internals (onboarding lane's), skeleton-not-spinner loading, serif titles,
  real-data scarcity, reduced-motion tap fallback behavior, 85dvh + safe-area sheet mechanics.

---

## 5 · THE BUILD PLAN (four phases, each independently shippable + verifiable)

### PHASE 1 — Make the door actually open *(the confirmed P0/P1s; no UX change)*
All in-lane: `src/lib/invite/*`, `src/pages/invite/*`.

| # | Fix | File |
|---|---|---|
| 1.1 | `previewInvite` → call the deployed `song-invite-preview` edge function (kills the RLS blindness: signed-in one-tap renders; landing shows title/inviter/faces; expired/exhausted map to their real error copy) | `src/lib/invite/inviteApi.ts:102` |
| 1.2 | `acceptInvite` → call the deployed `song-invite-accept` edge function; read the failure `code` → `InviteError` (kills fake success; writes the activity event; sends the owner email — the loop's heartbeat) | `src/lib/invite/inviteApi.ts:205` |
| 1.3 | On successful accept: clear the pending-invite key (kills the every-re-auth bounce back to a dead invite) and stop stamping the owner-side `first_collaborator_invited` milestone on the invitee (kills the onboarding vault-past) | `inviteApi.ts:213–231` |
| 1.4 | Wire `onRetry` at InviteErrorCard's only mount site; distinguish network vs not-found in preview | `InviteJoinPage.tsx:244` |
| 1.5 | Existing user on a new device: preserve `isExistingUser`, skip the name screen, never overwrite `display_name` | `InviteVerifyPage.tsx:94` |

*Gate: `tsc` + `build` + all 10 existing invite tests green (updated where the accept path's shape changed).*

### PHASE 2 — Cut the fat *(the Jobs pass)*

| # | Cut | Files |
|---|---|---|
| 2.1 | Delete `InviteTeamIntroPage`; verify/name/one-tap route straight to `/songs/:id/canvas?invite=1&role=…` | `pages/invite/InviteTeamIntroPage.tsx`, `authRoutes.tsx`, callers |
| 2.2 | Delete `InviteWelcomeBackPage`; fold session-match-accept / send-OTP into the join page's recognized-user CTA | `pages/invite/InviteWelcomeBackPage.tsx`, `InviteJoinPage.tsx`, `authRoutes.tsx` |
| 2.3 | Delete orphans: `FirstActionSheet`, `PhotoBanner`, dead `requestNewInvite` duplicate | `components/invite/*`, `inviteApi.ts:379` |
| 2.4 | PeoplePage: delete the contact-form/RolePicker/`sendInvite` universe (+ its phantom-backend API + dead pencil + `GeneratedLinkPanel` duplication); roster + one gold **Invite** → the shared ShareSongSheet | `PeoplePage.tsx`, `inviteApi.ts:326–376`, `components/roles/RolePicker.tsx` (if orphaned) |
| 2.5 | ShareSongSheet: one adaptive hero (Send via native share / Copy), link row as the quiet fallback, delete the separate "Share…" button, remove jump-to from the sheet |`ShareSongSheet.tsx` |
| 2.6 | Sent-state momentum: green flip → *"The door is open. Keep writing — you'll hear when they arrive."* → sheet auto-dismisses (~2.4s, reduced-motion: stays until tap) | `ShareSongSheet.tsx` |
| 2.7 | The standing link: reuse the song's existing valid token per role before minting | `inviteApi.ts` (`generateInviteToken`) |

*Gate: `tsc` + `build`; tests for deleted screens rewritten to assert the new direct routing; welcome-back tests fold into join-page tests.*

### PHASE 3 — One visual language *(coherence, contrast, calm)*

| # | Fix |
|---|---|
| 3.1 | One gold: every `#B5935A` → `var(--cog-gold)` family; all invite-surface hexes → COG tokens |
| 3.2 | One error voice: every `#E05440` → the muted terracotta; no red anywhere in the flow |
| 3.3 | Contrast: `#999`/`#CCC` microcopy → `var(--cog-warm-gray)` / `var(--cog-muted)` at AA |
| 3.4 | `GoldButton` fixed `height:56` → `minHeight` (long song titles stop painting outside the pill) |
| 3.5 | RoleToast: above the creation dock + `env(safe-area-inset-bottom)`; strip `?invite=1&role` after showing (no replay on reload) |
| 3.6 | Sheet a11y: focus trap + restore; Suspense fallback that shows *something* on cold networks; 44px link row; focus-visible + press states; reduced-motion on slide/stagger |
| 3.7 | Shells: `min-h-screen` → `100dvh` + safe-area on the invite pages; verify-headline line-break fix; avatar ring color from token |

### PHASE 4 — The loop's heartbeat *(arrival made real)*

| # | Fix |
|---|---|
| 4.1 | `useSongCollaborators`: refetch on presence join + window focus (roster never stale for the owner; new member's first idea toasts with a real name) |
| 4.2 | Invite arrivals never see the empty-room first-run flash (gate on `isInviteArrival` until hydration answers) |
| 4.3 | Invite URLs from `window.location.origin` (preview/staging links stop exiting their environment) |
| 4.4 | "Here now" dot matched by `userId`, not lowercased display name |

*Final gate (every phase): `npx tsc --noEmit` clean · `npx vite build` green ·
focused `npx vitest run` green · both walkthrough directions re-traced end to end.*

### Filed for other lanes (not ours to touch)
- **Backend:** `send-invite` (direct SMS/email delivery) edge function does not exist — we delete the caller; if direct-send is ever wanted, it's a Lovable build. `invite_requests` has no reader — owner never sees "asked for a new invite." Realtime on `song_members` would upgrade 4.1 from refetch to push.
- **Canvas lane:** the double card-arrival toast (`SongCanvasExperience.tsx:2226`) — two effects announcing one card.

---

## 6 · SUCCESS METRICS (before → after)

| Metric | Before | After |
|---|---|---|
| Owner invite flows | 2 (one against a phantom backend) | **1** |
| Actions on the share sheet | 3 overlapping | **1 hero + 1 quiet fallback** |
| Screens, link-tap → room (new user) | 5 | **3** (phone · code · name) |
| Screens, recognized user / new device | 5 (+ name wiped) | **2** (name preserved) |
| Screens, signed-in friend | broken | **1 screen, 1 tap** |
| Landing card in production | "Untitled Song — Someone invited you" | song · inviter · faces · lyric tease |
| Dead link outcome | fake success, OTP burned | honest error + working retry/request-new |
| Owner learns of arrival | only if in the room | **always** (activity + email + live toast + fresh roster) |
| Live links per song | +1 unrevokable per sheet-open | 1 standing key per role |
| Golds / error languages | 2 / 2 | **1 / 1** |
| Invite pages + components | 7 pages · 7 components | **4 pages · 5 components** |

*The number that matters most: a signed-in friend goes from **can't get in at
all** to **in the room in one tap**. That is the growth loop.*

---

*Lane B · The Open Door · vision v1 — audit-grounded, subtraction-first.*
