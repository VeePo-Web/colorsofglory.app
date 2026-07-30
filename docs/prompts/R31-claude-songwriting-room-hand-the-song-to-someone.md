# R31 — Hand the song to someone who isn't in the app

**Goal:** the writer sends a pastor, a producer, or their mom a link. That person
opens it on a phone, reads the lyrics, hears the song, and never sees a signup wall.

## Backend (done — Lovable)

- `song_share_links` table + `create_song_share_link`, `revoke_song_share_link`,
  `song_share_links_board` (owner-only writes, member reads, view counts tracked).
- `song_shared_view(_token)` — public, signed-out readable. Returns title, key/tempo,
  ordered sections with lyrics, and (when the link includes audio) live takes.
  Refuses revoked / expired / deleted with distinct errors. Each open bumps `view_count`.
- SDK: `src/integrations/cog/share.ts` — `fetchShareLinks`, `createShareLink`,
  `revokeShareLink`, `fetchSharedSong`, `shareUrl`.

## UI to build (Claude)

### 1. Sharing (inside the room)
- One entry point: **Share** in the room's overflow menu — not a fifth tab.
- The sheet is three lines, not a form:
  - `Anyone with this link can read the song.`
  - A single toggle: **Include the recordings** (on by default).
  - One gold CTA: **Create link** → the link appears with **Copy** (and the native
    share sheet on mobile via `navigator.share`).
- Existing links list below: label or date, `12 opens`, and a quiet
  **Turn off** text link. Turned-off links stay listed, dimmed, never deleted.
- Non-owners see the list read-only with no create/revoke affordances.

### 2. The shared page — `/s/:token`
- No app chrome, no nav, no signup modal. Cream background, the signature glow,
  serif title, `by {owner_name}` in warm gray, key · tempo chips.
- Sections render exactly like the sheet (serif labels, chord chips above lines),
  but with no caret, no buttons, no hover states.
- If audio is included: one calm player at the bottom — the primary take first,
  other takes as a simple list. One thing plays at a time.
- Footer: a single quiet line, `Made in Colors of Glory`, linking to `/`. That is
  the only conversion surface. No banner, no interstitial, no "sign up to hear more".

### 3. Error and edge states
- Revoked / expired / invalid each get their own one-line message on the same
  cream page, plus the same quiet footer link. Never a 404 shell.
- Print stylesheet: the shared page prints as a clean lyric sheet (lyrics only,
  no player, no footer).

### 4. Performance
- The page is a standalone lazy route — it must not pull the room bundle,
  TanStack mutations, or the capture stack.
- One request to paint. Cache `['shared', token]` with `staleTime: 60s`.
- Audio URLs are signed on demand at first play, never up front.

## Rules
- Never expose notes, people, activity, versions, or credits through a link.
- Never require an account to read a shared song.
- A link is a read, never a door into the room — collaboration still goes through invites.

## Done when
The writer taps Share, copies a link, and someone with no account reads and hears
the song on their phone in under two seconds.
