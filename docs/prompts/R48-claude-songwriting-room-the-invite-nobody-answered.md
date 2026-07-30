# R48 — The invite nobody answered

**Audit finding.** Sending an invitation is a one-way event. After the sheet closes there is no
trace of it anywhere in the room. The People panel shows members only, so a writer who invited three
people and got one sees two silences and no explanation — did the text never arrive? did the link
expire? Invitations quietly expire and the song stays a solo project. This is the single biggest
leak in the collaboration loop, and it is invisible.

**The fix, kept simple.** The People panel shows who is still on the way, and one tap keeps the same
link alive. Nothing is auto-sent. The writer shares it again themselves, the way they shared it the
first time.

No reminder emails. No pending badge. No "3 invites expiring" banner.

## Backend (already shipped — do not build)

- `song_pending_invites(_song_id)` → pending invitations with `waiting_days`, `is_expired`, token.
- `nudge_song_invite(_invite_id)` → extends the same link by 14 days; sender or owner only; once per
  day (`nudged_recently`).
- SDK: `src/integrations/cog/pendingInvites.ts` — `fetchPendingInvites`, `nudgeInvite`,
  `inviteWho`, `waitingLine`, `inviteLink`, `worthFollowingUp`, `isNudgeCooldown`.

## UI to build

### 1. "On the way" — People panel
Below the member list, a quiet group headed `On the way` (serif, 1rem, no count). One row per
pending invite:
- Line 1: `inviteWho(invite)` in charcoal, with the role in warm-gray after a middot.
- Line 2: `waitingLine(invite)` at 0.75rem warm-gray.
- Trailing: a ghost "Send again" button.

Expired rows get no red, no warning icon — just the honest words "the link has run out".

### 2. "Send again"
One tap: call `nudgeInvite`, then immediately open the native share sheet (or copy to clipboard on
desktop) with `inviteLink(token)` and the line *"Come write [Song] with me"*. Optimistically flip
the row's second line to "Link is good for another two weeks". On `isNudgeCooldown`, don't error —
just skip the RPC and open the share sheet anyway.

### 3. Withdraw
Long-press a pending row → "Take it back". Uses the existing revoke path. Row fades out with an
undo toast.

### 4. In the room, once
If `worthFollowingUp(invites).length > 0` and the writer is the owner, the People tile on the hub
shows one warm-gray sub-line: `1 person hasn't come in yet`. Nothing more — no dot, no colour, no
repeat. Tapping it goes to People and scrolls to "On the way".

## Performance
- Fetch pending invites with the People panel query, not separately — one round trip for that
  screen.
- The hub sub-line reads from the same cached People query; if it isn't cached, the hub shows
  nothing. Never block the hub on this.
- Nudge is optimistic; failure quietly reverts the sub-line, no toast.

## Copy
- Group heading: "On the way"
- Button: "Send again"
- Long-press: "Take it back"
- Hub line: "1 person hasn't come in yet" / "2 people haven't come in yet"
- Never: "pending", "expired invite", "reminder", "resend".
