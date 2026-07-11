# WEAVE — Line-Level Composition on the Canvas (D2-lead contract)

**Status:** v1.0 — shipped with the Weave build pass (this doc is the lane contract + integration map).
**Lead lane:** D2 (canvas mechanics). Render: D1. Craft libs: C3 (read-only). Persistence: A3/Lovable. Swap model shared with D3 (F19).

---

## 1. What Weave is

Point at a **final-tree section card** (e.g. "Chorus") and enter Weave mode. Every line
across the **idea-tree** cards that *fits* that section — by rhyme, meter, and theme —
**glows**. Tap a glowing line and it is *placed* into the section: appended to the
section card's body, the source line dims as "used", nothing is deleted. The section
card shows a **live rhyme ribbon** (A-A-B-B) and a **syllable meter** as it forms.
Tapping a line *inside* the forming section opens **Line Lab**: word-level swap
options (rhymes / near rhymes / related words) for the line's ending word — the line
stays the writer's; only a word they choose changes.

### The four invariants (breaking any one is a defect)

1. **SUGGEST, NEVER REPLACE.** Weave illuminates the writer's OWN lines. It never
   generates a lyric. Line Lab offers word-level *options*; the writer picks or
   doesn't. Every fit signal is *guidance*, never a gate — a non-glowing line is
   still tappable and placeable.
2. **NON-DESTRUCTIVE.** Placing a line never mutates the source card. The source
   line renders dimmed-italic "used" (per-song local map); un-placing restores it.
   Undo is one tap on the toast. Exit Weave → the board is exactly the board.
3. **TAP TO PLACE.** No drag anywhere in the Weave loop (390 px phones first).
4. **D2 COMPUTES, D1 RENDERS.** Fit scores, glow map, ribbon labels, meter counts
   all come from pure `src/lib/canvas/weave.ts` + the `useWeave` hook. Card faces
   and bars only paint what the hook hands them.

---

## 2. Verified toolkit (audited 2026-07-09 — charter corrections)

| Claimed by charter | Reality |
|---|---|
| `src/lib/lyrics/rhyme.ts` — `classifyRhyme`, `rhymeKey`, `lastWord`, `rhymeScheme` | **EXISTS, signatures exact.** Consumed read-only. |
| `src/lib/lyrics/syllables.ts` — `countSyllables`, `countLineSyllables`, `syllableBreakdown`, `lineSyllableProfile` | **EXISTS, signatures exact.** Consumed read-only. |
| `src/lib/lyrics/rhymeSuggest.ts` — `suggestWords(seed, lens, signal)` | **DID NOT EXIST.** Built in this pass to the charter's spec (Datamuse + cache + on-device corpus fallback). C3 owns it going forward; D2 consumes. |
| `RhymeSchemer.tsx` (297-line ribbon UI to reuse) | **DOES NOT EXIST anywhere in src/.** The ribbon is built fresh inside `WeaveTargetFace` (D1). |

## 3. The pieces (file map)

| File | Lane | Role |
|---|---|---|
| `src/lib/canvas/weave.ts` | D2 | Pure engine: `buildWeaveContext`, `scoreLineFit`, `weaveCandidates`, `lineKeyOf`, used-map storage (`cog:weave-used-<songId>`), tier thresholds. No React, no I/O beyond localStorage helpers. |
| `src/lib/canvas/weave.test.ts` | D2 | Engine truth tests. |
| `src/components/canvas/useWeave.ts` | D2 | The mode's state machine: enter/exit, glow map, `placeLine`, `undoPlace`, `swapTargetLine`, Line Lab open state, ribbon + meter data. Receives host mutators; owns meaning. |
| `src/components/canvas/WeaveCardFace.tsx` | D1 | Idea-card face while weaving: per-line glow rows (tap = place), used lines dimmed. |
| `src/components/canvas/WeaveTargetFace.tsx` | D1 | Section card while weaving: line + scheme chip (A/B/…) + syllable count + drift underline; tap a line → Line Lab. |
| `src/components/canvas/WeaveBar.tsx` | D1 | Bottom bar: what's forming, placed count, undo affordance, Done. |
| `src/components/canvas/LineLabSheet.tsx` | D1+D2 | Word-swap sheet: lenses (Rhymes/Near/Related), syllable-matched badges, corpus fallback, "Use this line". |
| `src/lib/lyrics/rhymeSuggest.ts` | C3 (born here) | `suggestWords(seed, lens, signal)` — Datamuse `rel_rhy`/`rel_nry`/`ml`, session cache, single-word filter. `suggestFromCorpus(seed, words)` — offline, `classifyRhyme`-mined from the writer's own lines. `seedFromText(line)`. |

### Host wiring (SongCanvasExperience)

- Entry: final-tree `lyric`/`section` card → More sheet → **"Weave lines into this section"** (hidden for viewers).
- `CanvasCardInteractions` gains: `weaveLines?`, `onWeaveLineTap?`, `weaveTarget?`, `onWeaveTargetLineTap?`, `weaveFaded?`.
- `CanvasCard` renders `WeaveCardFace` / `WeaveTargetFace` instead of the typed face when those props are present; `CardShell` gains `faded` (opacity damp, still tappable).
- On enter: viewport frames the Ideas tree (phones can't see both trees).

## 4. Fit scoring (the glow's honesty)

`scoreLineFit(line, ctx)` → `{ score ∈ [0,1], rhyme, syllables, syllableDelta, themeWords, reason }`.

- **Rhyme (≤ 0.50):** best `classifyRhyme(lastWord(line), each target ending)` — perfect 0.50, slant 0.32, assonance 0.16.
- **Meter (≤ 0.30):** `closeness = max(0, 1 − |count − target| / 4) × 0.30`, target = median of the section's `lineSyllableProfile`.
- **Theme (≤ 0.20):** shared non-stopword stems with the section text (+ label), `min(shared, 3)/3 × 0.20`.
- **Empty section:** no endings/meter to score against → every candidate gets a uniform faint glow with reason *"This section is empty — any line can start it."* Honest, not fake-precise.
- Tiers: `strong ≥ 0.55`, `warm ≥ 0.30`, else `faint`. Faint lines still glow slightly and still place — guidance, never a gate.
- Every glow carries a human `reason` string ("rhymes with 'waiting' · 8 syllables · shares 'grace'") — surfaced in the row's aria-label and subtitle. **No unexplained magic.**

## 5. Placement + persistence (A3/Lovable seam)

- Placing appends the line to the target card's `body` (client) → existing write path:
  `updateCanvasCard(sid, { body })` on the `canvas_cards` row via the host's serialized
  `syncServer`. **No new tables needed for v1** — the woven section IS the section
  card's body, which already travels to every device.
- The used-line map is per-song localStorage (`cog:weave-used-<songId>`), keyed
  `cardId::normalized-line-text::t:<targetId>` — **scoped per target**, so the same
  idea line can serve a Verse and later a Chorus ("used" in one section never gates
  another). Text-keyed, deliberately not index-keyed: reorders survive; editing the
  line's words orphans the entry, and the hook sweeps orphans (dead cards, dead
  targets, corrupt values, pre-scoping legacy keys) on every weave entry. It is
  *presentation state* (which of my lines have I already woven), device-local in v1.
- **Undo is OPERATIONAL, never a snapshot**: the toast's Undo removes exactly the
  line it names from the body *as it is at undo time* (re-read through a live ref) —
  undoing placement A can never wipe a later placement B or a co-writer's line that
  landed in between. Swap undo reverts only if the swapped line still stands. Un-place
  with no matching line just clears the mark — an unchanged body is never re-written
  (no phantom `updated_at` bumps into recap/activity).
- **The create-spine race is closed**: weaving into a section whose `canvas_cards`
  insert is still in flight queues the body write on the card's per-id chain; the
  server id resolves *inside* the closure (via the host's id-alias map) after the
  insert acks, and the mode itself survives the local→`db-card-` id swap
  (`weave.renameCard` is wired into the host's `swapCardId`).
  - **Filed for A3/Lovable (v2):** a `weave_placements` (or JSON column) server home if
    cross-device "used" dimming is wanted; and line-granular provenance
    (`source_card_id`, `source_line`) so credits can attribute a *line*, not a card.
- Un-place / undo removes the last matching line from the target body and clears the
  used mark. Source cards are never written.

## 6. Ribbon + meter (C3 read-only consumption)

- Ribbon: `rhymeScheme(targetLines)` → per-line letter chips. Same letter = same
  tone (three calm tones cycled: gold/sage/plum — never a rainbow). "-" = no ending.
- Meter: `countLineSyllables` per line; drift flag when `|count − median| ≥ 3`
  (amber dotted underline + reason text). **Never blocks placement.**
- Both are recomputed from the target body on every change — no shadow state.

## 7. Line Lab (shared swap model with D3's F19)

- Opens from a target-section line. Seed = the line's last word.
- Lenses: **Rhymes** (`rel_rhy`), **Near** (`rel_nry`), **Related** (`ml`) via
  Datamuse — free, no key, CORS-open. Cached per `(seed, lens)` in session.
- Each option chip shows its syllable count; options that keep the line's total
  count wear a quiet "keeps meter" ring.
- Choosing an option swaps ONLY the line's last word → preview → **"Use this line"**
  commits (same body write path), toast with Undo. The writer's line, the writer's choice.
- **Offline / API failure:** falls back to `suggestFromCorpus` — rhyming words mined
  from the writer's own idea-tree lines, labeled "from your own ideas". Calm empty
  state when nothing rhymes; never an error wall.
- D3's F19 "suggest a line" continues to exist for *collaborator* proposals; Line Lab
  is the *writer's own* tool. Both end in a single-line body write — same commit shape.

## 8. Sheet handoff (C3 seam)

The woven section card carries `section` (label) + plain-line `body` — exactly the
shape C3's sheet-seeding reads from `canvas_cards` (filed in the canvas handoff:
sheet seeding should read canvas_cards, not raw transcripts). That row IS the commit
payload: every placement writes through `updateCanvasCard(sid, { body })`, so the
section travels to every device and to C3's seeding path with **zero new plumbing**.
Weave deliberately does NOT emit `cog:sheet-event`s — that vocabulary is C3's
editor-local contract whose entity ids must exist in the SheetDoc; fabricating a
`sectionId` for a canvas card would be a lie. D3's recap/activity already hears the
change through the `canvas_cards` `updated_at` bump it watches today.

## 9. A11y + motion + perf commitments

- Glowing rows are real buttons: focusable, `aria-label` = the line + WHY it glows.
- Ribbon chips and meter counts carry SR text ("rhyme group A", "8 syllables, drifts from the section's 5").
- Reduced-motion: glow stays (color is not motion); pulses/pops are dropped.
- Glow map is memoized off `(cards, targetId, targetBody)`; scoring is pure and
  O(lines × endings); at 50-song scale nothing recomputes unless the target or the
  idea bodies change. Faces stay `memo`'d; weave props ride the existing
  `interactionsById` map so non-weave renders are untouched.
