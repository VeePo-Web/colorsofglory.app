# THE ORGANIZATION HALLWAY — folders, albums, and finding anything
## The library's organizing layer, rebuilt to feel exactly like Google Drive — and warmer
### Lane C vision · 2026-08-16 · standard defined in DRIVE-STANDARD-RESEARCH.md · execution prompt in docs/prompts/LANE-C-FOLDERS-ORGANIZATION.md

---

## 0 · THE NORTH STAR

One shelf. Albums on it like colored folders. Faces on everything. A gold dot
where something's new. One + button that makes anything. One search box that
finds anything. **An 8-year-old walks from "all our songs" into "the Worship
EP" into "the songs Sarah's on" without ever wondering where they are or how
to get back.**

The sentence the whole lane reduces to:
> **Everything has a place, every place has faces, and nothing takes more than
> one obvious tap to reach.**

---

## 1 · THE WORDS (super simple, musician-true)

The interface speaks eight words. No synonyms, no jargon, ever.

| The word | What it means | Why not the alternative |
|---|---|---|
| **Songs** | the things themselves | never "files", "items", "projects" |
| **Album** | a folder of songs (an EP, a setlist, a season) | the band's true word — behaves *exactly* like a Drive folder; never "collection", "playlist", "group" |
| **Shelf** | where everything lives (the library) | never "dashboard", "workspace" |
| **People** | the faces — who's in what | never "members", "collaborators", "users" |
| **New** | the one button that makes a Song or an Album | never "create", never two buttons |
| **Pinned** | held at the top (Drive's star) | one word for one idea |
| **New since you were here** | the gold dot's meaning | never "unread", "notifications" |
| **Ungrouped** | songs not on any album yet (Drive's root) | honest, judgment-free |

Copy rules: every label ≤4 words; every empty state names the next act;
no word an 8-year-old would ask about.

---

## 2 · THE HALLWAY (the walk, screen by screen)

**Room 1 — The Shelf.** Dark header "Your songs". Under it: the face row
(Everyone · Sarah · Caleb…), then the albums shelf — colored covers wearing
their own faces and gold dots — then the songs. One + New (gold, bottom
right). One search box. That's the whole room.

**Room 2 — An Album.** Tap a cover → the breadcrumb reads `All songs / Worship
EP`. Same grammar inside: the album's face row (only ITS people), its songs in
the band's own order, the same + New (adds into this album), the same search
(scoped here). Back is one tap on `All songs` — always.

**Room 3 — A Person (a lens, not a place).** Tap Sarah's face — on the shelf
or inside an album — and the room filters to her songs with an honest header
("Songs with Sarah · 4"). Tap Craig too: the songs they share. Tap Everyone:
the room comes back. The walls never move; the light changes.

**Room 4 — A Song.** Tap it → its room (the canvas — the other agent's
hallway begins here; ours ends at this door).

Four rooms. One grammar. No screen anywhere else in the organization.

---

## 3 · WHAT GETS BUILT (the plan, in shipping order)

### C1 · One + New *(Drive law: creation is one door)*
Replace the "+ New song" FAB and every scattered "New album" affordance with
ONE gold **+ New** opening a two-row sheet: **Song** / **Album** (rail
grammar; inside an album, "Song" lands in that album — Drive's contextual
create). Album creation asks ONE thing (a name) with color as a tap-optional
second beat, never a form.

### C2 · Albums wear faces, colors, and the dot *(Drive law: the row tells everything)*
- **Color**: 8 muted COG-palette swatches; the cover and its chip wear it.
- **Faces**: an album's cover carries the MiniFaceStack union of its songs'
  people — "who's on this EP" answered from the shelf.
- **The dot**: any unseen work inside → the album wears the gold dot and
  "Sarah · 2h" (max of its songs' pulses). Reuses `useCatalogPulse` +
  `bandIndex` — zero new data.

### C3 · The face row works INSIDE albums *(the composition Drive can't do)*
Today the band filter bypasses albums. Fix: inside an album, the face row
shows only that album's people and filters within it. "Which songs on this EP
has Craig touched" = two taps. This is the moment COG *beats* Drive.

### C4 · The breadcrumb *(Drive law: you always know where you are)*
The album header becomes a true breadcrumb: `All songs / Worship EP` — root
always tappable, title editable in place (rename where the name lives).

### C5 · Drag on desktop, checklist everywhere *(Drive law: moving is physical)*
`pointer: fine` only: drag a song card onto an album chip/cover — it files.
The long-press checklist stays the universal path; batch-select already works.

### C6 · One shelf, provenance becomes a lens *(the door split ends)*
The Owned/Invited tab split is a provenance question Drive would never make a
person answer. Fold: ONE "Your songs" shelf; "Shared with me" becomes a quiet
lens chip beside the faces (with Archived remaining its own calm tab).

### C7 · Shared albums — the real Drive *(the backend ask)*
`albums.ts` is deliberately a one-file seam over localStorage. FILE with
Lovable: `albums` + `album_songs` tables, band-readable via song membership,
so the Worship EP is the SAME shelf on every member's phone. Until it lands,
C1–C6 ship the full feel on the existing seam — and swap in one place.

### Deliberately NOT built
No nesting (one level, forever). No shortcuts concept. No trash. No
permissions on albums (the songs already carry the roles). No smart folders.
Drive's power came from restraint; ours does too.

---

## 4 · PROOF (how each pass verifies)

- `bandIndex`-style pure logic for album faces/pulse union → unit tests.
- The band drive (`band.mjs` pattern) grows album scenes: cover shows faces +
  dot; breadcrumb walk; in-album face filter; + New → Album → colored cover
  on the shelf. Screenshots feed the artifact.
- `verify-hallway.mjs` stays green (the door + spark corridors untouched).
- The canvas is NEVER touched — another agent owns it; our hallway ends at
  the song's door (`/songs/:id/canvas` navigation only).

*The measure of done: hand the shelf to an 8-year-old and ask for the six
proofs in DRIVE-STANDARD-RESEARCH.md Part 3. Six for six, no help.*
