# R14 — Songwriting Room Audit: "Taking the Song With You"

**Goal of the room (unchanged):** everything for this song stays connected here.
**Rule for this pass:** a song people cannot get *out* of the room is a song they
will keep re-typing into Notes. Export is not an advanced feature — it is trust.
Simple beats configurable everywhere in this pass.

## What the audit found

1. **No way out.** Lyrics, chords, takes and credits exist, but there is no single
   action that produces something a person can hand to a band, a producer, or a
   music director. The Credits mockup promises "Export credits"; nothing backs it.
2. **Export would have been a fan-out.** Any UI attempt would have fired 5+ reads
   and could render a half-consistent sheet. Not acceptable at this quality bar.
3. **Sharing today = screenshots.** That loses chords, section order, and every
   collaborator's name — the exact things this product says it remembers.

## What backend shipped

```ts
import {
  getSongExportPayload, toPlainTextSheet, toCreditsText,
} from "@/integrations/cog/exports";
```

- `getSongExportPayload(songId)` — ONE call. Returns `song` (title, key, tempo,
  time signature, dedication, tags), `sheet_meta` (capo/display/mode),
  `sections` (ordered, with chord anchors in `content` and `plain_text`),
  `takes` (name, length, primary flag, author), `credits` (name, role, and the
  real contribution kinds: Lyrics / Voice memo / Ideas / Notes / Chords),
  and `generated_at`.
- `toPlainTextSheet(payload)` / `toCreditsText(payload)` — ready-to-paste text.
- Any member may export, including view-only. Non-members: `not_a_member`.

## What to build

1. **One affordance, three outputs.** A single "Share this song" sheet from the
   room header overflow. Exactly three rows — no settings, no checkboxes:
   - **Copy lyrics** → `toPlainTextSheet`, clipboard, toast "Lyrics copied."
   - **Lyric sheet (PDF)** → print-styled route `/song/:id/sheet/print`, cream
     paper, serif title, section labels, chord chips above lines, footer
     `Colors of Glory · <date>`. Use `window.print()`; no PDF dependency.
   - **Credits** → same print route with `?view=credits`, one line per person,
     the exact Credits-screen wording.
2. **Never a spinner-only screen.** Fetch the payload before opening the sheet;
   the sheet opens with content already in hand. If it fails: one calm line and
   a retry — the room stays untouched behind it.
3. **Print CSS is the whole design.** `@page { margin: 18mm }`, no shadows, no
   glow, no dark backgrounds, page-break-inside: avoid on sections. Test at A4
   and Letter. A printed page that wastes ink on the radial glow is a bug.
4. **Say when it was made.** Footer carries `generated_at` in the person's locale.
   Exports are snapshots; the room keeps moving.
5. **View-only people can export.** Do not gate this behind R10's write
   capabilities — reading and carrying the song out is a listener's right.

## Acceptance

- Song with 6 sections + chords + 3 takes + 3 members → one call, complete sheet.
- Copy lyrics pastes cleanly into iMessage with section labels intact.
- Print preview shows no glow, no nav, no buttons; sections never split mid-line.
- Viewer role can complete all three exports; a non-member gets nothing.
- Opening the share sheet twice does not refetch unless the room changed.
