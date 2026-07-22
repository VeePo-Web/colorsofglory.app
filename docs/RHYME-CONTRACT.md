# The Rhyme Contract — Live Rhyme Schemer
### How rhyme assistance works in Colors of Glory, and the two invariants it can never break
*Shipped 2026-07-22 by the Lyrics lane (C3). Progress log: `docs/features/RHYME-SCHEMER-progress.md`.*

---

## 1. The two load-bearing invariants

1. **Strictly additive — never breaks.** The schemer is a layer ON TOP of the lyrics
   editor. When it is closed, the editor's code path is byte-identical to life before
   it existed (`LyricLine` receives `undefined` for both seam props and behaves exactly
   as before). When it is open, everything it does runs in effects — debounced 250ms,
   abort-controlled, laddered — off the input path. Typing, singing, scrolling, and
   saving are identical whether the schemer is on, off, slow, offline, or throwing.
2. **Never generates.** It surfaces candidate words and phrases the WRITER chooses
   from (RhymeZone/MasterWriter in-context). It never writes or completes a line;
   a candidate enters the lyric only on an explicit tap, at the cursor, of the line
   the writer is already editing.

## 2. The safety ladder

```
rung 1  Datamuse (online, theme-biased at source)      best palette
rung 2  on-device classifier over the writer's OWN     "Offline — these are from
        words (rhyme.ts + the song's corpus)            your own words."
rung 3  silence                                        nothing shown, no error
```

Every fetch and every rank runs inside try/catch off the input path. A partial
Datamuse outage (one lens up) degrades quietly inside rung 1 (`Promise.allSettled`);
`suggestPalette` throws only when every lens failed. The single "couldn't reach the
rhyme book" line appears only when the writer explicitly opened the assist AND both
online and corpus rungs came back empty.

## 3. The ranking model (where the quality lives)

Candidates come from three parallel Datamuse lenses — `rel_rhy` (perfect, keeping
its multi-word PHRASE results), `rel_nry` (near/slant), `ml` (related) — each with
`md=s` (syllable metadata) and `topics=` set from the writer's theme (source-level
bias, Datamuse's documented 5-topic cap; theme words lead, scripture content words
fill by frequency).

Then the composite re-rank, per candidate:

```
score = TIER_WEIGHT            perfect 1.0 · near/slant 0.95 · related 0.55
                               (slant stays close to perfect on purpose — B-Rhymes'
                                insight; worship writing leans on slant, not corny
                                perfect rhymes)
      × PHRASE_BONUS 1.05      multi-word rhymes are often the best pick
      × THEME FACTOR           ×1.65 when the candidate lives in the theme/scripture
                               word set · ×1.25 on a shared 4-char stem
      × METER FIT              ×1.15 when it lands the line exactly on a parallel
                               line's syllable count · ×1.05 within one
      × DATAMUSE SCORE         0.75 + 0.25 × normalized lens score
```

Tiers are re-derived on-device (`classifyRhyme` on the candidate's last word — so
phrases tier by how they END); when the spelling heuristic disagrees with Datamuse's
pronunciation data, the lens wins (never dropped, never mis-tiered downward).
Output groups, calm and capped: **Perfect (10) / Near · Slant (10) / Phrase (8) /
Related (8)**, every chip syllable-tagged, theme hits wearing a quiet gold ring.
Session cache per `(seed, topics)`, ~80 entries.

## 4. The context (theme + scriptures)

The writer sets a free-text THEME and attaches exact SCRIPTURES via H1's
`ScripturePicker` (consumed, never rebuilt — `onPicked(label, text)` provides the
passage text whose content words join the ranking set). Context persists per song in
`localStorage` (`cog.rhyme.ctx.<songId>`) — device-local, zero backend surface,
try/catch-guarded for private mode.

## 5. Live input

- **Typing:** the line being edited mirrors its draft out through the optional
  `onDraft` seam; the seed is the draft's `lastWord`.
- **Singing:** Say-It-Structured's `useLiveTranscript` (C2, consumed not rebuilt —
  on-device Web Speech, graceful `supported=false` elsewhere). The mic button renders
  only when supported; the transcript tail feeds the seed; a quiet italic line shows
  what was heard.
- **Insert:** while a line is being edited, its input registers an insert-at-cursor
  function; palette chips prevent pointer-down default so tapping one **never blurs
  the input** — focus, the editing session, and the commit-on-blur flow are untouched.
  With no line being edited, chips are read-only inspiration (reading is enough).
- **The ribbon:** the active section's A/B scheme (`rhymeScheme`) sits quietly in the
  panel header; the full-song Craft view remains the deep scheme reading.

## 6. Scale + performance posture

Datamuse is free, keyless, CORS-open, and cached per session — at 1M writers each
client hits it directly (no COG backend in the path, nothing to fall over), debounced
to at most ~4 requests/second/writer at worst and usually served from cache. No COG
server code, no schema, no analytics content (nothing the writer types or sings
leaves the device except the seed word + topic words to Datamuse). All work is
client-side and abandoned on unmount/abort.

## 7. Lane boundaries

| Lane | Relationship |
|---|---|
| C3 (this) | Owns `src/lib/lyrics/**`, the palette + schemer UI, the sheet-page seam |
| C2 (Say-It-Structured) | `useLiveTranscript` consumed as-is — STT is never rebuilt here |
| H1 (Scripture) | `ScripturePicker` + `cog/scripture.ts` consumed as-is |
| C4 (Voice/audio) | Untouched — no audio routes through the schemer |
| A1 (Tokens) | Consumed (`--cog-*`) |
| D3 (Collaboration/F19) | The `data-cog-line-id` suggestion mount is untouched |

## 8. A11y + calm

44/36px targets; every chip labeled with tier + syllables (+ "on your theme",
"tap to insert"); groups are labeled `role="group"`s; no motion anywhere in the
panel (nothing to reduce — `prefers-reduced-motion` is satisfied by design); the
live tail is `aria-live="polite"`; the schemer never steals focus (pointer-down
prevention on every chip) and never interrupts — it is dismissible, opt-in, and
absent by default.
