# Live Rhyme Schemer · Progress

## 2026-07-22 (later) — The songwriter dogfood pass

Sat in the writer's chair and used the shipped schemer to write a verse. Found eight
things a real songwriter would be unhappy about, and fixed all eight. None of the
never-breaks / never-generates guarantees changed — every fix is still off the input
path and inside the safety ladder.

| # | What frustrated a songwriter | Fix |
|---|---|---|
| 1 | **Dead on open** — the palette was blank until you tapped into a line to edit it | Seed from the LAST WRITTEN line when nothing is being edited — open it and it's already rhyming your last line |
| 2 | **Rhymes scrolled away** — panel pinned at the top, edit a line lower down with the keyboard up, the rhymes are off-screen | The panel is now `position: sticky; top: 0` — it FOLLOWS you to the line you're writing |
| 3 | **Manual theme** — not theme-aware until you typed a theme | Auto-theme: when no theme/scripture is set, the song's OWN frequent words bias the ranking (`frequentContentWords`) — on-message with zero setup |
| 4 | **Mic was shadowed** — the line being edited always beat the sung tail, so singing did nothing while a line was focused | Seed priority: singing now > typing a line with an ending word > last written line |
| 5 | **Typing felt heavier** with it open — the page rebuilt the corpus + active-lines every keystroke | Memoized `rhymeSongLines` (on `doc`) + `rhymeActiveLines` (on doc + draft) — typing latency is identical to the schemer being off |
| 6 | **Phrase group almost always empty** — Datamuse rarely returns phrases | Phrase rhymes are now MINED from the writer's own lines (`phraseRhymesFromLines`) and merged fresh on top of the cached Datamuse result |
| 7 | **Could only rhyme the last word** | A "Rhyme on" picker (brainstorm mode) offers the last line's last few words so you can rhyme any of them |
| 8 | **Fresh empty line showed nothing** | Starting a new empty line now rhymes the PREVIOUS line (rhyme-to-match) — the actual songwriting move |

**Engine changes (`rhymePalette.ts`)**
- `frequentContentWords(lines)` — the auto-theme source (frequency-ranked, stopword-
  filtered).
- `contextTopics(ctx, fallback)` + `contextWordSet(ctx, fallback)` — the fallback
  (song words) fills topics/boost only when explicit theme+scripture leave room; the
  component passes `[]` when an explicit theme exists so it always wins entirely.
- `PaletteOpts.boostWords` threaded into `rankCandidates` (auto-theme boost) and both
  palette builders.
- `phraseRhymesFromLines(seed, lines)` + an internal `mergePhrases` — phrase rhymes
  from the writer's own lines, merged onto the cached Datamuse base each call
  (cache holds the Datamuse-only palette; phrases are fresh so they track edits).

**Panel changes (`RhymeSchemer.tsx`)**
- New `songLines` prop (replaces `corpus`; corpus + boost words + phrases all derive
  from it internally). Seed-priority logic, rhyme-to-match on a fresh line, the
  "Rhyme on" word picker, and the auto-theme placeholder ("following your song's
  words") when no theme is set.

**Page changes (`SongSheetPage.tsx`)**
- `rhymeSongLines` + `rhymeActiveLines` memoized; the mount is wrapped in a
  `sticky top:0` container; the unused `corpusFromBodies` page import removed.

**What was verified**
- tsc clean · vite build green · rhyme-palette 24/24 (adds auto-theme topics +
  boost-rank, `frequentContentWords`, `phraseRhymesFromLines` + offline/online phrase
  merge) · lyric-rhyme 14/14 · sheet suites 53/53. Every never-breaks path is
  unchanged: closed schemer = `undefined` seams = the pre-feature editor; the ladder
  (Datamuse → own words → silence) is intact; chips still preventDefault so a tap never
  blurs the input.

**Still needs a phone (unchanged from the first pass, plus)**
- The sticky follow with the iOS keyboard up (visual — confirm the panel stays in view
  above the keyboard as you edit a lower line).
- The "Rhyme on" picker + rhyme-to-match feel while writing a real verse.
- Datamuse latency + iPhone Web Speech + airplane-mode rung 2.

## 2026-07-22 — The build pass (engine + panel + sheet seam)

(unchanged — the original build; see below)

**Audit correction first (the spec's file inventory was stale):** there was no
`RhymeSchemer.tsx` anywhere in the repo (the spec claimed 297 lines). What DID exist,
verified: `rhymeSuggest.ts` (Datamuse three-lens + cache + corpus fallback, single
words only), `rhyme.ts` (classifyRhyme/rhymeScheme/lastWord), `syllables.ts`,
`LineLabSheet.tsx` (the canvas one-line word lab), the sheet's Craft view (full-song
A/B scheme — the deep ribbon already shipped), `useLiveTranscript` (C2) and
`ScripturePicker` (H1). Built the schemer as NEW files on top; touched none of the
existing consumers (LineLabSheet/weave/CraftView work as before).

- `src/lib/lyrics/rhymePalette.ts` — the palette engine (three Datamuse lenses,
  topics bias, composite rank, four groups, session cache, corpus fallback rung).
- `RhymePaletteStrip.tsx` — the calm grouped chip strip (syllable tags, theme ring,
  pointer-down-prevented chips).
- `RhymeSchemer.tsx` — the opt-in panel (theme + scripture, mic, A/B ribbon).
- SongSheetPage seam — "Rhyme book" toggle; `LyricLine`'s optional `onDraft` /
  `registerInsert` props (undefined when closed = byte-identical editor).
