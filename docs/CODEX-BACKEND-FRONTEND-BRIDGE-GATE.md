# Codex Backend-Frontend Bridge Gate v1
## Making Lovable Backend + Claude Frontend Feel Like One Instant Song Room

Codex owns the quality of the handoff between backend reality and frontend feeling.

Claude builds the surfaces.
Lovable builds the backend.
Codex makes the connection feel instant, calm, typed, safe, and invisible to the songwriter.

The user should never feel the border between a component, a query, an auth rule, a storage upload, or a payment endpoint. They should feel one thing:

Everything for this song stays connected here.

---

## 1. Codex Bridge Role

Codex may connect backend and frontend when:

- Lovable has exposed the backend contract.
- Claude has built the frontend surface or interaction shell.
- The missing work is an integration layer, not a new product feature.
- The fix improves speed, clarity, recovery, permission truth, or mobile trust.
- The change can be verified with typecheck, build, QA gate, and route smoke.

Codex bridge work is allowed to include:

- Replacing mock data with existing Supabase, RPC, Edge Function, storage, or payment calls.
- Adding typed adapters that map backend rows to COG UI objects.
- Adding React Query loading, stale, retry, mutation, invalidation, and optimistic state.
- Translating backend errors into COG-safe copy.
- Adding quiet UI states for saving, syncing, retrying, disabled permissions, and storage limits.
- Making small UI polish changes when real backend states reveal friction.

Codex bridge work must not include:

- Owning database schema, RLS policies, billing rules, storage quotas, or payment semantics.
- Inventing backend behavior Lovable did not provide.
- Redesigning Claude's frontend beyond QA polish.
- Expanding product scope while pretending it is performance work.

---

## 2. The Bridge Standard

Every backend-connected interaction must answer instantly.

If the server is fast, the UI should feel alive.
If the server is slow, the UI should still feel heard.
If the server fails, the user's song work should still feel protected.

### Interaction Budgets

| Interaction | Required user feedback |
| --- | --- |
| Open song room | Skeleton or cached room state under 200ms |
| Add idea | Optimistic card under 100ms |
| Record memo | Recording shell under 150ms |
| Save lyric | Quiet saving state under 150ms |
| Send invite | Pending invite row under 150ms |
| Accept invite | Route toward intended song without dashboard detour |
| Change role | Optimistic selected role under 100ms |
| Upload memo | Stable upload row immediately |
| Hit storage cap | Calm protective state, no panic copy |
| Upgrade action | Button pending state under 100ms |

### Visual Rules

- Never show a blank page while waiting for backend data.
- Never let backend data arrival resize the main layout unexpectedly.
- Never show raw technical language such as `mutation failed`, `RLS`, `RPC`, `bucket`, `constraint`, or `JWT`.
- Never rely on color alone to show permission, status, ownership, or sync state.
- Never make the user wonder whether their lyric, idea, invite, or recording was saved.

---

## 3. Contract Checklist

Before Codex approves a backend-connected feature, verify:

### Route Context

- `songId` survives login, invite acceptance, refresh, and route redirects.
- `inviteToken` survives phone verification and name entry until acceptance is complete.
- `role` maps to the correct visible permissions.
- `plan` and storage state do not interrupt the first-song or invite moment incorrectly.
- `returnTo` sends the user back into the intended song room.
- Canvas `layer` or `mode` state is preserved where it matters.

### Data Shape

- Frontend types match actual Supabase generated types or explicit adapter output.
- Nullable backend fields are handled without layout breakage.
- Dates are normalized before rendering.
- Empty arrays are treated as real states, not failures.
- Missing profile/avatar/song metadata has graceful fallback copy.

### Query Behavior

- Query keys include the right user, song, role, layer, and page parameters.
- Stale times reflect product risk:
  - song room summary: short but cacheable
  - activity feed: fresh on open
  - permissions: fresh on route entry
  - billing/storage: fresh before gated action
- Mutations invalidate or update the exact visible query.
- Duplicate submissions are blocked without making the UI feel frozen.
- Slow requests preserve the current screen.

### Error Recovery

- Failed saves preserve drafts.
- Failed uploads preserve local recording context where practical.
- Failed invites preserve email/phone/role entry.
- Expired invite routes to a warm recovery screen.
- Unauthorized actions show role-aware copy, not technical denial.
- Conflict or stale data produces a calm refresh/retry path.

### Performance

- Integration code does not bloat base app or shared nav chunks.
- Heavy audio, transcription, analysis, export, and admin code lazy-load behind intent.
- Visible feedback is optimistic or skeletonized before network work completes.
- Large lists paginate, window, cluster, or summarize.
- Realtime subscriptions mount only where needed and unsubscribe on route change.

---

## 4. Feature Bridge Gates

### Song Catalog

Backend inputs:

- owned songs
- invited songs
- archived songs
- plan state
- free-song limit

Codex verifies:

- catalog opens with cached/skeleton cards
- second owned song correctly triggers upgrade
- invited songs do not count against the invitee's free song
- deleted, archived, or revoked songs do not create broken cards
- large catalogs remain smooth on mobile

### Song Room / Whiteboard Canvas

Backend inputs:

- song object
- membership role
- idea nodes
- edges
- voice memo summaries
- latest activity summary

Codex verifies:

- root song card appears before deep data is ready
- Add idea is optimistic
- role restrictions match backend truth
- nodes render from normalized state
- 50, 250, 1,000, and 5,000-node futures have a performance path
- canvas never blocks on audio, transcription, waveform, or collaborator fetches

### Lyrics and Chords

Backend inputs:

- sections
- lyric lines
- chord positions
- autosave mutation
- version snapshot hook

Codex verifies:

- typing never waits on server
- autosave state is quiet and stable
- failed save keeps local draft
- long lyrics and many chords do not shift layout
- viewer/reviewer restrictions are truthful and calm

### Voice Memos

Backend inputs:

- upload URL
- finalize endpoint
- signed playback URL
- waveform summary
- transcript status
- storage usage

Codex verifies:

- recording starts before upload concerns appear
- upload row is stable immediately
- active player is singular, not one audio engine per card
- waveform summaries do not force heavy React re-renders
- failed upload protects the idea
- storage cap protects work without fear language

### Invite and Roles

Backend inputs:

- invite preview
- OTP/auth state
- acceptance RPC
- song membership
- role permissions
- referral attribution

Codex verifies:

- invitee reaches the intended song
- invite state survives phone verification
- role cards match backend permissions
- expired/accepted/revoked invites recover warmly
- collaborator entry appears optimistically after acceptance
- no generic dashboard detour

### Activity, Versions, Credits

Backend inputs:

- activity log
- version snapshots
- contribution ledger
- hidden/unauthorized item filtering

Codex verifies:

- recap is grouped and calm
- hidden content does not leak through summaries
- version restore preview is intentional
- failed restore does not damage current work
- credits remain readable with long contributor lists

### Billing, Storage, Referrals

Backend inputs:

- current plan
- storage usage
- storage limit
- checkout session
- referral status
- founder code state

Codex verifies:

- upgrade appears after value, not before the first song moment
- plan gates are fresh before paid actions
- storage warnings have stable, calm UI
- checkout buttons enter pending state immediately
- referral stats avoid hype and remain understandable

---

## 5. Bridge Audit Report Format

Use this format whenever Codex audits a real backend/frontend connection.

### Verdict

- Pass
- Pass with watchlist
- Blocked by frontend
- Blocked by backend contract
- Blocked by bridge polish
- Not ready

### Evidence

- route tested
- viewport tested
- command output
- backend contract touched
- query/mutation path touched
- screenshot or browser note when applicable

### Findings

List P0 to P3:

- P0: loses song work, leaks private data, wrong song, broken auth, crash
- P1: blocked core flow, bad permission state, major mobile or performance issue
- P2: noticeable friction, stale state, layout shift, unclear retry
- P3: polish that lowers world-class feel

### Ownership

Assign the smallest owner:

- Claude: frontend feature behavior or visual structure
- Lovable: backend contract, schema, auth, storage, payment, server rule
- Codex: typed adapter, query wiring, cache, retry, optimistic UI, subtle QA polish

### Retest Plan

State the exact command, route, viewport, and scenario Codex will retest after the fix.

---

## 6. First Bridge Priorities

The next Codex bridge passes should happen in this order:

1. Invite acceptance into song room.
2. Start first song into real song object.
3. Song catalog real owned/invited/archived data.
4. Song whiteboard real song object and idea-node adapter.
5. Voice memo upload and playback states.
6. Storage and plan gates.
7. Activity recap and credits.

Reason:

These are the flows where backend friction most directly breaks trust. If these feel instant and protected, the rest of the songwriting engine has a strong foundation.

---

## 7. Codex Final Filter

Before approving any bridge work, Codex asks:

1. Did the user see immediate feedback?
2. Did the screen remain stable while backend work happened?
3. Did real permissions match visible controls?
4. Did failed backend work preserve the song idea?
5. Did the route keep the user inside the right private song room?
6. Did the copy stay calm and human?
7. Did the integration avoid new bundle or render cost?
8. Is the owner clear: Claude, Lovable, or Codex bridge polish?

If any answer is no, the bridge is not world-class yet.
