# THE DRIVE STANDARD — research report & spec sheet
## How Google Drive's organization actually works, and what COG's shelf takes from it
### Lane C (Folders & Organization) · 2026-08-16 · companion to FOLDERS-HALLWAY-VISION.md

> Google Drive is the world's most-used shared organizer. Billions of people —
> children included — navigate it without a manual. This report breaks down WHY
> it feels effortless, then specs each mechanism against what COG's library has
> today. Drive is the standard; COG must meet it in feel and beat it in warmth.

---

## PART 1 · WHY DRIVE FEELS SIMPLE (the ten mechanisms)

### 1. One kind of container, everywhere
Drive has exactly ONE organizing object: the folder. Not tags, not labels, not
smart collections, not workspaces — a folder. You can put a thing in a folder,
and a folder in a folder. Every other surface (Recent, Starred, Shared) is a
*view*, never a second container to manage. **The lesson: one noun to learn.**

### 2. A thing lives somewhere
Every file has a location. "Where is it?" always has an answer, and the answer
is a place you can walk to. Views (Recent/Starred) never confuse this — they
show the file but the file still *lives* in its folder. **The lesson: place is
the mental model; views are lenses on places.**

### 3. Few doors at the top
Mobile Drive is four tabs: Home · Starred · Shared · Files. Desktop is one
sidebar with the same few doors. Nobody chooses between twelve destinations.
**The lesson: fewer doors than fingers.**

### 4. The row tells you everything without opening it
A Drive row/tile = icon + name + shared-faces + "who · when" + one ⋯ menu.
You know what it is, whose it is, who touched it, and how to act — from the
list. **The lesson: the container's face carries the status; opening is for
working, not for finding out.**

### 5. One + button makes everything
A single "+ New" creates a folder or uploads files — every act of creation
behind one button in one corner. **The lesson: creation is one door too.**

### 6. Moving is physical
Drag a file onto a folder — it goes in. On mobile: ⋯ → Move → walk the
breadcrumb picker. Both gestures mirror the physical world (put the paper in
the folder). **The lesson: organizing is direct manipulation, not form-filling.**

### 7. Search is a place of its own, with people in it
One search box finds everything; filter chips (People · Type · Modified)
refine it. The People chip shows FACES. "Show me Craig's stuff" is one tap.
**The lesson: the fastest organization is no organization — search + people.**

### 8. Time and importance organize for free
Recent (automatic) and Starred (one tap) mean most sessions never need a
folder at all. Filing is for keeps; finding is for now. **The lesson: the
system files by time so people only file by meaning.**

### 9. Color is wayfinding, not decoration
Folder colors exist for one reason: your eye finds "the red one" faster than
reading. A dozen muted choices, applied per folder. **The lesson: one glance
beats one read.**

### 10. Empty states teach the next act
An empty folder says "Drop files here". An empty Drive says what the + button
does. **The lesson: emptiness is the tutorial.**

### What Drive gets WRONG (and COG must not copy)
- **Infinite nesting** becomes a filing cabinet people get lost in. Bands
  need one level — an album holds songs, the shelf holds albums. Stop there.
- **Shortcuts vs. copies vs. shared-with-me locations** confuse even adults.
  COG's answer stays radically simpler: a song can sit on more than one
  album, and that's just true, with no "shortcut" concept surfaced.
- **Trash, ownership transfer dialogs, permission matrices** — enterprise
  noise. COG's calm equivalents already exist (archive-not-delete, the one
  door with two plain roles).
- **Sterile tone.** Drive is a warehouse. COG is a sanctuary — same
  mechanics, warm voice.

---

## PART 2 · SPEC SHEET — Drive mechanism → COG today → the gap

| # | Drive mechanism | COG today (repo-verified) | Gap / spec |
|---|---|---|---|
| S1 | One container: the folder | Albums exist (`lib/library/albums.ts`): create/rename/reorder/delete, multi-membership, "Ungrouped" smart view | **Language + feel pass**: albums must *behave* like folders everywhere (see S6, S8); keep ONE level deep, forever |
| S2 | **Folders are SHARED** — the whole point of Drive | **Albums are `localStorage` only** — device-local, single-person, lost with browser data. A band's folders don't travel | **THE structural gap.** File with Lovable: `albums` + `album_songs` tables (band-visible via song membership). Until then: the vision ships the FEEL; the seam (`albums.ts`) was built to be swapped in one place |
| S3 | Few doors | Owned·Invited·Archived tabs (calm-gated), band chips, albums shelf/rail | Owned/Invited is a *provenance* split Drive wouldn't make. Spec: "Your songs" one shelf; provenance becomes a lens, not a door (band filter already unions them — finish the thought) |
| S4 | The row tells everything | Cards: title, count, status chip, faces (MiniFaceStack), pulse "Sarah · 2h" + unseen dot | Nearly met — extend the same face/pulse grammar to ALBUM covers (an album's face = its people + its freshness) |
| S5 | One + New | "+ New song" FAB **plus** separate "New album" buttons in shelf/rail/sheets | Spec: ONE gold "+ New" → "Song" / "Album" (two rows, rail grammar). Creation becomes one door |
| S6 | Moving is physical | Long-press → albums checklist (Apple "Add to Playlist" style); batch-select → Add to album; swipe-remove inside an album | Meets the mobile bar. Add: drag-onto-album-chip on `pointer: fine` (desktop Drive gesture); keep checklist as the universal path |
| S7 | Search + people chips | Search reaches songs AND album names; band face-chips filter by person (AND) | Compose them INSIDE an album: the face row must also filter within an open album ("who's on this EP") — today the band filter bypasses albums entirely |
| S8 | Breadcrumb — you always know where you are | Album header with back link ("All songs") | Meets it at one level. Spec: the header IS the breadcrumb: `All songs / Worship EP` — tappable root, always |
| S9 | Recent + Starred organize for free | Sort=Recent default, Continue shelf, Pins (Apple Notes, MAX_PINS) | Met. Language check only (see the words table in the vision) |
| S10 | Folder color | Albums have no color | Spec: 8 muted COG-palette swatches on the album sheet; the cover + chip wear it. One glance beats one read |
| S11 | Who's in this folder | Nothing — an album shows a song count only | Spec: album face-stack (union of its songs' people) + "who · when" pulse on the album cover; tapping an album then filtering by a face answers "which of OUR songs are in this EP" |
| S12 | Empty states teach | Album empty copy exists ("Tap Add songs above") | Meets; sweep all empties to the same teach-the-next-act voice |
| S13 | Activity panel (who did what) | Per-song pulse shipped; per-album none | Spec: album pulse = max of its songs' pulses (any unseen inside → dot on the album). The shelf answers "something new in Worship EP" at a glance |

## PART 3 · THE 8-YEAR-OLD PROOFS (Drive passes these; the shelf must too)
1. "Put these songs in a folder" → long-press, tap the album, done — or drag.
2. "Make a new one" → the one + button → Album → name it → it exists, colored.
3. "Where's the song?" → its card shows on the shelf AND inside its album; the
   breadcrumb always walks home.
4. "Who's been in this album?" → the faces are on its cover; tap one to see
   which of its songs they touched.
5. "What's new?" → gold dots on songs AND albums; "Sarah · 2h" says who.
6. "Find it" → one search box, or tap a face, or tap the album — three paths,
   one answer.

*Every spec above is frontend-real today except S2 (shared albums — filed).
The vision doc sequences the build; the LANE-C prompt executes it.*
