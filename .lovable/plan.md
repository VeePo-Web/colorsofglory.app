## Goal

Make every text input in the capture flow (lyrics, scripture, idea/note, chord freeform, section label, etc.) feel like talking to a friend: tap the mic, speak, watch your words appear, tap again to stop. Already-existing infrastructure (`useLiveTranscript` Web Speech hook + `transcribe-take` ElevenLabs edge function) gets reused.

## UX (the part the user cares about)

Every input field grows a small gold **mic chip** in its trailing edge.

- **Idle:** subtle gold mic icon.
- **Tap:** pulses, ring grows. Permission prompt the first time only.
- **Speaking:** live partial words stream into the field in muted gold; finalized words snap to charcoal.
- **Tap again (or 1.5s of silence):** stops, smart-formats, locks the text in.
- **Highlight-then-mic:** dictation **replaces** the selection. No highlight → **appends with a space**. (Per user spec.)
- **Holding the mic for >400ms:** push-to-talk mode (record while held, release to stop). Standard tap = toggle mode.
- **No Web Speech support (Firefox, some Android webviews):** mic chip silently swaps to a "record + upload" flow that captures up to 30s, sends to the existing `transcribe-take` ElevenLabs endpoint, then drops the transcript in.
- **Errors are calm:** "Mic blocked — enable in Settings" inline, no toast spam.

## Engine selection (auto, invisible to user)

1. **Web Speech API** (`useLiveTranscript`, already shipped). Used when `getRecognitionCtor()` returns non-null. Free, on-device, instant partials.
2. **ElevenLabs Scribe batch fallback** via existing `supabase/functions/transcribe-take` edge function. Triggered when Web Speech is unsupported OR errors out mid-session. Records via `MediaRecorder` → uploads blob → returns text.

A new tiny hook `useDictation()` picks the engine, exposes a uniform `{ supported, isRecording, partial, start, stop, error }` shape, and wraps both paths.

## Per-field smart formatting (user picked "per-field")

A pure function `formatDictation(raw, fieldKind)` runs on the final transcript before insert. No AI call for v1 — these are deterministic rules, fast, free, predictable:

| Field kind | Formatting |
|---|---|
| `lyrics` | Convert sentence boundaries / long pauses into line breaks. Capitalize first word of each line. Strip stray "comma", "period" verbalizations (already common). |
| `scripture` | Normalize spoken refs ("John three sixteen", "psalm twenty three verse one") → `John 3:16`, `Psalm 23:1`. Reuses existing `parseReference.ts`. If the result is a valid ref, also auto-trigger the existing ScripturePicker fetch. |
| `chords` | Tokenize spoken chord names ("C major", "A minor seven", "G slash B", "four chord", "one five six minor four") → chord tokens. If a key is set, route numbers through the Nashville engine and **inject chips into the progression** instead of the text field. Freeform fallback if parsing fails. |
| `idea` / `note` / generic | Raw transcript + light punctuation cleanup (collapse double spaces, capitalize first letter, add trailing period if missing). |
| `section_label` | Title-case, strip filler ("um, verse one" → "Verse 1"). |

Spoken-number → digit conversion ("twenty three" → 23) lives in a tiny `spokenNumbers.ts` helper shared by scripture + chords.

## Insert behavior (highlight-replace, else append)

A shared `insertDictatedText(el, formatted, raw)` utility on the `<input>`/`<textarea>` ref:

1. Read `selectionStart` / `selectionEnd`.
2. If `start !== end` → replace the selection range with `formatted`.
3. Else → append `(value.endsWith(" ") || value === "" ? "" : " ") + formatted` to the end and move caret to new end.
4. Fire a synthetic `input` event so React Hook Form / controlled state picks it up.
5. Highlight the just-inserted span in faint gold for 600ms (`transition opacity`) so users see what landed.

## Files to create

```
src/components/capture/DictationMic.tsx        // The mic chip + states (visual)
src/components/capture/DictationField.tsx      // Wraps any <Input>/<Textarea>; renders mic + manages insertion
src/hooks/useDictation.ts                      // Engine picker (Web Speech → ElevenLabs fallback)
src/lib/dictation/insertDictated.ts            // Highlight-replace / append logic
src/lib/dictation/formatDictation.ts           // Per-field formatters
src/lib/dictation/spokenNumbers.ts             // "twenty three" → 23
src/test/dictation/format.test.ts              // Per-field rules
src/test/dictation/insert.test.ts              // Highlight vs append behavior
```

## Files to edit (Claude UI surface only — `src/integrations/cog/*` is the Lovable boundary; everything below is Claude-territory)

- `src/components/capture/CaptureSheet.tsx` — wrap lyrics textarea, scripture input, idea textarea, section-label input, and the chord freeform fallback in `<DictationField>`.
- `src/components/capture/ScripturePicker.tsx` — add `<DictationMic>` next to the reference input, route output through scripture formatter, auto-fetch on valid ref.
- `src/components/capture/ChordPicker.tsx` — add a mic to the freeform-input panel; if a chord token parses, push it onto the progression chips instead of the text field.

## Files NOT touched

- No backend changes. `transcribe-take` edge function already exists.
- No new tables, RLS, or migrations.
- `src/integrations/cog/*` untouched — dictation is purely a UI concern. Lovable's boundary holds.

## Visual language

- Mic chip = 28px gold-pale circle with a Lucide `Mic` icon at `var(--cog-gold)`. Recording state: same circle filled `var(--cog-gold)`, pulsing ring at 18% opacity, scale 1 → 1.08 → 1 at 1.2s.
- Live partial text rendered in `var(--cog-gold)` at 70% opacity. Final words fade to `var(--cog-charcoal)` over 200ms.
- No banners. No modals. No toasts on success.

## Acceptance scenarios

1. Empty lyrics field → tap mic, say "I will sing of your mercy forever" → field shows the line, capitalized, with a line break if you paused. Mic returns to idle.
2. Lyrics with text + cursor highlighting "Verse 1" → tap mic, say "Bridge" → "Verse 1" is replaced by "Bridge" in place.
3. Lyrics with text, nothing highlighted → tap mic, say "and your love endures" → appended with a leading space.
4. Scripture field → say "psalm twenty three" → field shows `Psalm 23` and the ScripturePicker preview loads automatically.
5. Chord picker, key = G, freeform mic → say "G, D, E minor, C" → 4 chord chips appear in the progression strip; freeform field stays empty.
6. Firefox (no Web Speech) → mic chip records up to 30s via MediaRecorder, shows "Transcribing…" inline, then drops formatted text in.
7. Mic permission denied → mic chip greys out, tooltip "Mic blocked — enable in Settings".

## Out of scope (intentional)

- Real-time AI clean-up via Lovable AI Gateway (user chose deterministic per-field formatting). Easy to add later as a `?aiPolish` prop on `<DictationField>`.
- Multi-language. Defaults to browser locale; English-only formatting rules in v1.
- Punctuation voice commands ("new line", "period"). Web Speech already inserts most of these on iOS Safari; we'll lean on that.
