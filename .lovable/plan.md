# Smart Chords — Key-Aware Nashville Number System

Make adding chords as frictionless as Scripture: pick a key, tap chords from a key-aware palette, and the app stores them as Nashville numbers underneath. Change the key later and every chord transposes instantly — across every section of the song.

## The core idea

A songwriter rarely thinks "C major then A minor." They think "**1 then 6m**" — the *function* of the chord inside the key. That's the Nashville Number System (NNS). If we store chords as numbers and only render them as letters at display time, two huge things become free:

1. **One-tap key change.** Capo up, drop the vocal a step, hand the song to a baritone — every chord, every section, every voice memo annotation updates in place. No re-typing.
2. **Smart suggestions.** Once we know the key, we know the 7 diatonic chords (1, 2m, 3m, 4, 5, 6m, 7°). The chord palette becomes a 7-button row of the *most likely* chords, not a 144-chord scroll.

## Nashville Number System — what the engine must know

A song in a major key has 7 scale degrees. Each gets a default quality:

```text
Degree:   1     2m    3m    4     5     6m    7°
C major:  C     Dm    Em    F     G     Am    B°
G major:  G     Am    Bm    C     D     Em    F#°
D major:  D     Em    F#m   G     A     Bm    C#°
```

Beyond diatonic, NNS notation we must support:

- **Quality overrides:** `1` (major by default), `1m` (minor), `1°` (dim), `1+` (aug), `1sus`, `1sus2`, `1sus4`
- **Sevenths/extensions:** `17` (dom7), `1maj7`, `1m7`, `1add9`, `19`, `113`
- **Accidentals:** `b3` = flat third (Eb in C), `#4` = sharp four (F# in C), `b7` (Bb in C)
- **Slash chords / inversions:** `1/3` = C/E in C, `4/5` = F/G in C
- **Minor-key view (later):** in A minor, `1` = Am, `3` = C, `6` = F, `7` = G. v1 ships major-key only; minor-key toggle is a follow-up.

We do **not** need to invent music theory — just a small pure-TS engine that converts `{degree, quality, accidental, extension, bass}` ↔ a chord letter for any key.

## What the user actually sees

### 1. Key + tempo header (new, replaces the freeform "Key: G · 92 BPM · I–V–vi–IV" placeholder)

```text
┌─────────────────────────────────────────┐
│  Key  [ G  ▼ ]    Tempo  [ 92 ▼ ] BPM   │
│  Show as:  ( Letters ) ( Numbers )      │
└─────────────────────────────────────────┘
```

- **Key picker:** 12 keys in a horizontal scroll, with the current key highlighted gold. Default to the song's stored key (or G if none).
- **Show-as toggle:** the *display* preference only. Storage is always numbers. Toggling re-renders the same chord chips as `G C D Em` or `1 4 5 6m`.

### 2. Diatonic chord palette (the 7 most-likely chords)

A single row of 7 tappable chips, labeled with both the number and the letter for the current key:

```text
┌────┬────┬────┬────┬────┬────┬────┐
│ 1  │ 2m │ 3m │ 4  │ 5  │ 6m │ 7° │
│ G  │ Am │ Bm │ C  │ D  │ Em │F#° │
└────┴────┴────┴────┴────┴────┴────┘
                + more…
```

Tap a chip → it appends to the progression. Long-press (or tap the `▾`) opens a quality sheet: `maj7`, `7`, `sus2`, `sus4`, `add9`, `/3`, `/5`. Tap "+ more…" to reveal non-diatonic chords (`b7`, `b3`, `#4`, borrowed minors, etc.) in a second drawer.

### 3. Progression strip (the thing being built)

```text
│  1   │  5   │  6m  │  4   │   ← stored
│  G   │  D   │  Em  │  C   │   ← rendered in current key
```

- Tap a chord to edit quality/bass, swipe left to delete, drag to reorder.
- A "bar" separator chip (`|`) so users can group `1 5 | 6m 4` into bars.
- "Repeat ×2" chip for `(1 5 6m 4) ×2`.

### 4. Transpose in one tap

Change the key in the header from G → A. Every chip in the palette and the progression strip animates to the new letters in place (250ms cross-fade). The numbers don't move — they *are* the song. Toast: "Transposed to A. Tap to undo."

## How it stores

A song already has a key/BPM somewhere; we promote it to a structured `chord_charts` row and add a new `chord_progressions` payload that lives on a section or a standalone capture block.

```ts
// stored shape (numbers only)
type NumberChord = {
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  accidental?: "b" | "#";        // b3, #4
  quality: "maj" | "min" | "dim" | "aug" | "sus2" | "sus4";
  extension?: "7" | "maj7" | "m7" | "9" | "add9" | "13";
  bass?: { degree: number; accidental?: "b" | "#" };  // slash chord
};

type Progression = {
  key: string;             // song key at time of capture (for round-trip safety)
  mode: "major";           // v1
  bars: Array<{
    chords: NumberChord[];
    repeats?: number;
  }>;
};
```

A `PendingBlock` with `kind: "chords"` carries `progression: Progression` instead of a freeform `text`. The `text` field becomes the rendered letter string (`G D Em C`) so existing review UI still works without changes.

## Pieces to build (Claude + Lovable split)

### Claude (frontend only — the ask)

| File | Purpose |
|---|---|
| `src/lib/chords/nashville.ts` | Pure engine: `toLetters(progression, key)`, `toNumbers(letters, key)`, `transpose(progression, fromKey, toKey)`, `diatonic(key)`. Zero deps, fully unit-testable. |
| `src/lib/chords/keys.ts` | The 12 keys, enharmonic preferences (F# vs Gb based on the key signature), sharp/flat note tables. |
| `src/lib/chords/parseChord.ts` | Tolerant text parser so a user *can* type `Cmaj7/E` and we still convert to `1maj7/3` in C. Used by the Lyrics editor when chord chips are typed inline. |
| `src/components/capture/ChordPicker.tsx` | The new key header + diatonic palette + progression strip. Replaces the `chords` branch of `CaptureSheet`. |
| `src/components/capture/ChordChip.tsx` | One chip that knows how to render itself as letters or numbers based on a `ChordDisplayContext` (React context, defaulting to the song's preference). |
| `src/components/capture/CaptureSheet.tsx` | Swap the `chords` placeholder for `<ChordPicker />` exactly the way `<ScripturePicker />` is wired today. |
| `src/integrations/cog/chords.ts` | Thin SDK: `getSongKey(songId)`, `setSongKey(songId, key)`, `saveProgression(blockId, progression)`. |
| `src/test/chords-nashville.test.ts` | Unit tests for diatonic generation, transpose round-trip across all 12 keys, slash chords, sus/maj7 round-trip, enharmonic preference (D♭ in F minor world, C# in A major). |

### Lovable (backend — separate handoff, not this turn)

- Add `key text`, `mode text default 'major'`, `bpm int`, `display_pref text default 'letters'` to `songs` (or `chord_charts`).
- New `chord_progressions` table OR a `progression jsonb` column on the existing capture block / section row. RLS via `is_song_member`. GRANTs as standard.
- Migration to backfill any existing freeform chord text by running it through `parseChord.ts` server-side (optional, can skip — old freeform stays as text).

### Codex (perf — later)

- Stress-test transpose on a 200-bar progression. Must stay under 16ms.

## Acceptance scenarios

1. **Happy path.** Song key = G. Open Chords. Tap `1`, `5`, `6m`, `4`. Strip shows `G D Em C`. Save. Reopen — same chips. Toggle "Show as: Numbers" — chips show `1 5 6m 4`.
2. **Transpose.** Same song, change key to A. Strip shows `A E F#m D`. Numbers unchanged. Undo restores G.
3. **Quality.** Long-press `1` → choose `maj7`. Chip becomes `Gmaj7` / `1maj7`.
4. **Slash chord.** Long-press `4` → bass `/5`. Chip becomes `C/D` / `4/5`. After transpose to A, `D/E`.
5. **Borrowed chord.** Tap "+ more…" → `b7`. In G that's `F`. In A that's `G`.
6. **Typed input fallback.** In the lyrics editor someone types `Bb` over a line while the song is in F. Parser converts to `4` and stores it; the chip renders correctly forever after.
7. **Enharmonic correctness.** Key = F. The 7° chord renders as `E°` (not `Fb°`). Key = F#. The 4 chord renders as `B` (not `Cb`). Verified by tests.
8. **Non-goals (v1):** minor-key tonic view, modal interchange labels (♭VII vs b7 stylistic choice → we use `b7`), MIDI playback, capo math.

## What I need from you before building

1. **Default key when none is set** — G, C, or "ask the user the first time they open Chords"? (My recommendation: ask once, remember per song.)
2. **Display default** — Letters or Numbers? Most worship teams in the US use Nashville numbers on the chart but letters in conversation. (My recommendation: Letters, with a one-tap toggle.)
3. **Minor keys in v1?** Adds ~1 day of work and a second diatonic palette (`1m 2° b3 4m 5m b6 b7`). Easy to defer.
4. **Bars + repeats UI** — ship in v1 or treat the progression as a flat list of chords for now?

Answer those four and I'll move to build.
