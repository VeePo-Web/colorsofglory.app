# Handoff: Dictation on every capture input

**Owner:** Claude Code (UI). Lovable touches nothing here — no migrations, no edge functions, no `src/integrations/cog/*` changes. Backend pieces (`useLiveTranscript` hook, `transcribe-take` edge function) already exist.

## What to build

A reusable mic affordance that bolts onto every text input in the capture flow so the user can talk instead of type. Tap once = toggle. Hold = push-to-talk. Highlight-then-mic replaces the selection; otherwise appends with a leading space.

## Files to create

```
src/components/capture/DictationMic.tsx      # 28px gold-pale chip, Lucide Mic, pulse ring when active
src/components/capture/DictationField.tsx    # Wraps <Input>/<Textarea>; renders mic + manages insertion
src/hooks/useDictation.ts                    # Picks Web Speech (preferred) → ElevenLabs fallback
src/lib/dictation/insertDictated.ts          # Highlight-replace / append + synthetic input event
src/lib/dictation/formatDictation.ts         # Per-field formatters (lyrics, scripture, chords, idea, section)
src/lib/dictation/spokenNumbers.ts           # "twenty three" → 23
src/test/dictation/format.test.ts
src/test/dictation/insert.test.ts
```

## Files to edit

- `src/components/capture/CaptureSheet.tsx` — wrap lyrics textarea, idea textarea, section-label input, and the chord freeform fallback in `<DictationField fieldKind="…" />`.
- `src/components/capture/ScripturePicker.tsx` — add `<DictationMic>` next to the reference input; on final transcript run through scripture formatter, then auto-fetch when `parseReference()` returns a valid ref.
- `src/components/capture/ChordPicker.tsx` — add a mic next to the freeform-input panel. If tokens parse as chords and a key is set, push them straight onto the progression chips via the existing add-chord path instead of into the text field.

## Engine selection (inside `useDictation`)

1. Try `useLiveTranscript` (Web Speech). Use it when `getRecognitionCtor()` is non-null.
2. Fallback: `MediaRecorder` → POST to existing `supabase.functions.invoke("transcribe-take", { body: { audio: base64 } })` → use returned text. Cap recording at 30s and show inline "Transcribing…" while waiting.
3. Expose uniform API: `{ supported, isRecording, partial, start, stop, error }`.

## Insert behavior (`insertDictated.ts`)

```ts
export function insertDictatedText(
  el: HTMLInputElement | HTMLTextAreaElement,
  formatted: string
): void {
  const { selectionStart: s, selectionEnd: e, value } = el;
  let next: string;
  let caret: number;
  if (s != null && e != null && s !== e) {
    next = value.slice(0, s) + formatted + value.slice(e);
    caret = s + formatted.length;
  } else {
    const sep = value.length === 0 || /\s$/.test(value) ? "" : " ";
    next = value + sep + formatted;
    caret = next.length;
  }
  // setNativeValue so React's controlled-input tracker picks the change up
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(el, next);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
```

## Per-field formatters

| `fieldKind`     | Rules |
|-----------------|---|
| `lyrics`        | Split on `. ` / `? ` / `! ` / long-pause markers → newlines. Capitalize each line's first word. Strip literal "comma" / "period" tokens. |
| `scripture`     | Run through `spokenNumbers` then `parseReference()`. If valid → canonical `Book C:V[-V]`. If not → raw text. |
| `chords`        | Tokenize on commas/whitespace. Map "C major" → `C`, "A minor seven" → `Am7`, "G slash B" → `G/B`, spoken numbers ("one", "five", "six minor") → degree tokens. Return `{ chords: NumberChord[], leftover: string }`. |
| `idea` / `note` | Collapse double spaces. Capitalize first char. Add trailing `.` if none. |
| `section_label` | Strip filler words ("um", "uh", "okay"). Title-case. Recognize "verse one" → "Verse 1". |

## Visual states (use design tokens, no custom hex)

- Idle chip: `bg-[var(--cog-gold-pale)] text-[var(--cog-gold)]` 28px circle, `rounded-full`.
- Active: filled `bg-[var(--cog-gold)] text-white`, Framer Motion pulse ring `scale: [1, 1.08, 1]` over 1.2s loop, ring opacity 0.18.
- Live partial inside the field: muted gold (`text-[var(--cog-gold)]/70`); on finalize fade to charcoal over 200ms.
- Permission denied: chip greys to `var(--cog-muted)`, tooltip "Mic blocked — enable in Settings". No toast.

## Acceptance tests

1. Empty lyrics → tap → "I will sing of your mercy forever" → field shows line, capitalized, mic idle.
2. Lyrics with selection highlighting "Verse 1" → tap → say "Bridge" → "Verse 1" replaced.
3. Lyrics with text + no selection → tap → say "and your love endures" → appended with leading space.
4. Scripture → say "psalm twenty three" → field shows `Psalm 23` + preview fetch fires.
5. ChordPicker key=G, freeform mic → "G, D, E minor, C" → 4 chips appear; freeform stays empty.
6. Firefox (no Web Speech) → records ≤30s, "Transcribing…", inserts result.
7. Mic denied → greyed chip + tooltip; no console spam.

## Out of scope

- AI clean-up via Lovable AI Gateway (user picked deterministic per-field rules). Leave a `?aiPolish` prop hook for later.
- Non-English locales (default to `navigator.language`, English rules only in v1).
- Voice commands like "new line" / "period" — Web Speech on iOS Safari already handles most.

## Reference points in the codebase

- `src/hooks/useLiveTranscript.ts` — Web Speech wrapper, reuse its `getRecognitionCtor` check.
- `src/lib/scripture/parseReference.ts` — scripture canonicalizer.
- `src/lib/chords/nashville.ts` + `src/lib/chords/parseChord.ts` — chord tokenizer for the chord-field path.
- `supabase/functions/transcribe-take/index.ts` — fallback endpoint (already deployed).