# Live Rhyme Schemer · Progress

## 2026-07-22 — The build pass (engine + panel + sheet seam)

Contract of record: `docs/RHYME-CONTRACT.md`.

**Audit correction first (the spec's file inventory was stale):** there was no
`RhymeSchemer.tsx` anywhere in the repo (the spec claimed 297 lines). What DID exist,
verified: `rhymeSuggest.ts` (Datamuse three-lens + cache + corpus fallback, single
words only), `rhyme.ts` (classifyRhyme/rhymeScheme/lastWord), `syllables.ts`,
`LineLabSheet.tsx` (the canvas one-line word lab), the sheet's Craft view (full-song
A/B scheme — the deep ribbon already shipped), `useLiveTranscript` (C2) and
`ScripturePicker` (H1). Built the schemer as NEW files on top; touched none of the
existing consumers (LineLabSheet/weave/CraftView work as before).

**What shipped**

- `src/lib/lyrics/rhymePalette.ts` — the palette engine: three parallel Datamuse
  lenses with `topics=` theme bias + `md=s`, PHRASE rhymes kept (rhymeSuggest filters
  them; here they're first-class), composite rank (tier × theme/scripture × meter fit
  × normalized score; slant 0.95 vs perfect 1.0 on purpose), four capped groups,
  session cache per (seed, topics), `Promise.allSettled` so partial outages degrade
  inside rung 1, throws only when fully offline, `paletteFromCorpus` as rung 2.
- `src/components/songsheet/RhymePaletteStrip.tsx` — the calm grouped chip strip;
  syllable tags, gold ring on theme hits, pointer-down-prevented chips (tapping never
  blurs the lyric input), read-only when no line is being edited.
- `src/components/songsheet/RhymeSchemer.tsx` — the opt-in panel: theme input +
  scripture chips (H1 picker consumed in a collapsible), mic via `useLiveTranscript`
  (rendered only when supported), the active section's A/B ribbon in the header,
  debounced/aborted ladder, context persisted per song in localStorage.
- SongSheetPage seam — "Rhyme book" toggle in the Tools sheet; `LyricLine` gains two
  OPTIONAL props (`onDraft`, `registerInsert`) that are `undefined` when the schemer
  is closed (the editor's closed-state path is byte-identical to before); when open,
  drafts mirror out through stable ref-backed callbacks (the memoized SectionViews
  never re-render on keystrokes) and the active input registers insert-at-cursor
  with natural spacing + caret restore.

**The never-breaks proof (forced failure, by construction + test)**

- Schemer CLOSED: `LyricLine` receives `undefined` seams → the exact pre-existing
  code path. Nothing is fetched, mounted, or subscribed.
- Schemer OPEN + offline: `suggestPalette` rejects → rung 2 serves the writer's own
  words ("Offline — these are from your own words") → if that's empty too, the strip
  shows the calm empty line + "couldn't reach the rhyme book." The editor's typing/
  commit path never awaits any of it (fetch lives in a debounced, aborted effect).
- Schemer OPEN + slow: 250ms debounce + AbortController — stale responses are
  dropped; typing latency is untouched (the only per-keystroke work is a setState
  mirror + `lastWord` on one line).
- Focus: chips preventDefault on pointer-down — the input never blurs, the
  commit-on-blur flow never fires early. Tested by code-trace; the phone check is
  listed below.
- Tests: 15/15 in `src/test/rhyme-palette.test.ts` — theme-hit near rhyme outranks
  off-theme perfect, related below rhymes, phrase grouping + bonus, meter-fit lift,
  dedupe/seed-exclusion, corpus rung, cache hit (no re-fetch), full-offline throw,
  partial-outage quiet degrade.

**Ranking behavior with a theme + scripture set (the "grace + Psalm 23" check)**

With theme "grace mercy" + Psalm 23 attached, the ranking set includes shepherd/
pastures/waters/soul…; `topics=grace,mercy,shepherd,…` biases Datamuse at source and
the re-rank lifts any candidate whose words live in that set (×1.65) — verified at
the unit level ("mercy" as a near rhyme outranks the perfect "place" for seed
"grace"). Live-API behavior needs a network session — phone check below.

**What could not be verified here (how to test)**

- Real Datamuse responses + the felt latency: open a song sheet → Tools → Rhyme
  book → set theme "grace" + attach Psalm 23 → edit a line ending in "grace" →
  the palette should gather within ~a second, on-message + slant candidates first,
  each chip syllable-tagged; tap one mid-edit and the caret should stay put.
- The sung path on a real iPhone (Web Speech support varies): tap the mic, sing a
  line, watch the tail + palette follow the last word.
- The forced-failure phone check: airplane mode → the palette shows "from your own
  words" (or the calm empty line) and typing/saving is visibly unaffected.

**Next passes (named, not started)**

- Palette in the CAPTURE surface (the same engine; mount by the live transcript in
  the recording review, C4-coordinated).
- `sl` (sounds-like) as a fourth quiet lens for B-Rhymes-style loose matches.
- Per-song theme seeding from the song's existing tags/canvas theme zone when those
  surfaces expose it.
