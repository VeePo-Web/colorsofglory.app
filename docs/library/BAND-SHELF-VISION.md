# THE BAND SHELF — the library becomes the band's shared drive
## Vision + build plan · researched 2026-08-12 (4-lens repo fleet, RLS-proven)

> The user's sentence, verbatim north star: *"almost like a Google Drive shared
> folder. if you have a band, then you can put in all the songs and filter it by
> every single person in the band… and they are open so everyone in the band can
> add to whichever songs… people can upload all their voice memos and drafts of
> that song… a song room for each song… easily filter it by person, or by the
> song name. as organized as possible for every person."*

---

## 0 · THE NORTH STAR

Open **Songs**, and it is the band's shared drive: **every song you all share,
one shelf, with your people's faces on top.** Tap **Craig** — Craig's songs.
Tap **Craig and Parker** — the songs they wrote together. Type a name — the
song. Long-press a song — drop in a folder of voice memos without even opening
it. Tap a song — its room, where everyone adds. An 8-year-old can run the
band's whole archive.

---

## 1 · WHAT THE RESEARCH ESTABLISHED (all repo-verified, file:line in the fleet report)

1. **No band entity exists in the backend** — no bands/teams/workspaces table
   across all 140 migrations. The honest band IS the aggregate of per-song
   memberships, and the read side already spans it: `list_my_songs()` returns
   every song the caller belongs to.
2. **The person filter is buildable frontend-only, today.** RLS-proven chain:
   a member can batch-read `song_members` rows for ALL their songs in one
   `.in('song_id', ids)` query ("Members can view membership" policy), and any
   authenticated user can read profiles' *display columns* (column-level grant —
   `select('*')` would fail; the select list must be explicit).
   **Trap confirmed:** `profiles!inner(...)` embeds on `song_members` CANNOT
   work — there is no FK — which is a live silent bug in `useCircle` (its catch
   returns `[]`). The Band Shelf uses TWO batched queries joined client-side.
3. **The band lever exists frontend-only:** a song **owner** may directly
   INSERT rows into `song_members` for their own song (the RLS INSERT policy
   checks only ownership). So "add the people from your other songs, one tap
   each" ships today — the Drive-folder move. (It bypasses the invite loop's
   consent/email; acceptable for people who already co-write with you, and the
   arrival still surfaces via presence/roster. Undo = existing
   `remove_song_member` RPC.)
4. **Multi-file upload is one attribute away.** `saveMemoDurable` is the
   canonical entry (blob durable in IndexedDB BEFORE network, capture-outbox
   retry on reconnect/heartbeat/reload, idempotency key, filename preserved
   end-to-end, quota errors retained-not-burned). The existing `UploadDropZone`
   (voice layer + voice page) is single-file only; per-file `saveMemoDurable`
   in a loop inherits the full guarantee. "Drafts" map honestly to named voice
   memos — there is no draft object, and none is needed.
5. **The library** (SongCatalogPage) already has search, sort, views, albums,
   pins, batch-select — but **zero people dimension**, and its Owned/Invited
   tab split fractures a band's shelf in two.

---

## 2 · THE DESIGN (Jobs pass: what earns its place)

### The face row — people as the library's first filter
A quiet horizontal row of your people above the library controls: **Everyone ·
[SL] Sarah · [CB] Caleb · [PK] Parker…**, each chip a face + first name + song
count. It appears only when your library actually has other people in it (a
solo writer never sees band chrome — the calm-gating law the library already
lives by). Tap = filter. Tap two = **songs those people share** (AND — the
musically meaningful question: "the songs Craig and Parker wrote together").
While a person filter is active, the Owned/Invited split stops mattering —
the shelf shows **all** matching active songs in one list, with an honest
header: *"Songs with Sarah & Caleb · 4"*. Clear the chips, the tabs return.
Search composes with everything.

### Drop files on the song — without opening it
Long-press any song (the existing actions sheet) → **Add voice memos** → the
system file picker, multi-select → each file lands as a named voice memo in
that song's room, retry-safe, titled from its filename. The room's Voice layer
and the voice page gain the same multi-select. One toast, honest counts:
*"6 memos saving to 'Grace in the Waiting' — safe on this device even
offline."* This is the Drive gesture: files onto the folder.

### Add your people — the band, one tap each
In the invite sheet (the ONE door), the owner sees **Your people** — everyone
from their other songs who isn't in this one yet — each with a one-tap **Add**.
Create a song, open the door, tap-tap-tap: the band is in, the song appears on
everyone's shelf. Undo per person. The share link stays the hero for people
not yet in any song.

### What we deliberately do NOT build
- No "create a band" ceremony, no band settings page, no membership admin —
  the band *emerges* from co-writing, which is already how the app grows.
- No faces-on-every-card yet (the cards are dense; the face row carries the
  dimension). Revisit after real use.
- No third dock action in the room (the Voice layer's drop zone is one tap
  away; the dock keeps its two acts).

### FILED with Lovable (the backend asks, in priority order)
1. `list_my_song_members()` RPC — collapse the 2-query batch to one round trip
   (clone of `list_song_members` without the song filter).
2. A real `bands` table + `songs.band_id` + auto-membership hook, so a song
   created "in the band" seeds everyone WITH the proper invite-accepted
   activity/email loop — the one thing aggregation can't do.
3. `add_members_to_song(_song_id, _user_ids[])` RPC that writes the activity/
   notification loop the direct insert skips.
4. (To the Circle lane) `useCircle`'s `profiles!inner` embed silently returns
   `[]` — no FK exists; it needs the same 2-query fix.

---

## 3 · THE BUILD (this pass)

| # | Piece | Files |
|---|---|---|
| 1 | **bandIndex** — pure logic: build `{bySong, people}` from member+profile rows; AND-filter; chip-visibility rule | `src/lib/library/bandIndex.ts` + unit tests |
| 2 | **useBandPeople** — TanStack hook; 2-query RLS-proven batch (explicit profile columns; never the FK embed) | `src/lib/library/useBandPeople.ts` |
| 3 | **PeopleFilterRow** — the face chips, calm-gated, multi-select | `src/components/library/PeopleFilterRow.tsx` |
| 4 | **Catalog integration** — filter state, band-view override of tabs, honest header, search composition | `SongCatalogPage.tsx` |
| 5 | **Multi-file upload** — `UploadDropZone` → `onFiles(File[])`; loops in VoiceLayerPanel + VoiceMemosPage; **Add voice memos** in SongActionsSheet + catalog handler via `saveMemoDurable` | `UploadDropZone.tsx`, `VoiceLayerPanel.tsx`, `VoiceMemosPage.tsx`, `SongActionsSheet.tsx`, `SongCatalogPage.tsx` |
| 6 | **Add your people** — owner-only section in ShareSongSheet; direct `song_members` insert + Undo via `removeMember`; roster invalidation | `src/components/invite/AddYourPeople.tsx`, `ShareSongSheet.tsx`, host wiring, `members.ts` (`addMember`) |

Gate: `tsc` clean · bandIndex + invite + FinalListenPage tests green ·
`verify-hallway.mjs` 30/30 still green · commit + push.

*The 8-year-old walkthrough this must survive: "show me Craig's songs" (one
tap) · "show me the songs Craig and Parker did together" (two taps) · "put
these five voice memos into Amazing Grace" (long-press, Add, pick) · "let the
whole band into my new song" (open door, tap each face).*
