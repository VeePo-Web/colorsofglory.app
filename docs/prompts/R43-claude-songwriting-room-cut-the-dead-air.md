# R43 — Songwriting Room Audit: "Cut the dead air off the front"

## The one goal
The room exists so a songwriter can capture an idea and hear it back without friction.
Right now every take replays the fumble: the phone coming up, the chair, three seconds
of nothing before the hum. Multiply that by fifty listens and the room feels slow even
though nothing is slow.

## The rule for this feature
This is **not** an audio editor. There is no timeline, no zoom, no waveform scrubbing UI
with two draggable handles by default. There is one gold handle and one sentence.

## Backend (already shipped by Lovable)
- `takes.trim_start_ms` (int, default 0) and `takes.trim_end_ms` (int, nullable).
- RPC `set_take_trim(_take_id, _start_ms, _end_ms)` — owner/contributor only, clamps to duration.
- RPC `clear_take_trim(_take_id)` — restores the full original.
- Nothing destructive ever happens: the stored audio file is untouched forever.
- SDK: `src/integrations/cog/trim.ts`
  - `playWindow(take)` → `{ startSec, endSec, lengthMs }` for the `<audio>` element
  - `suggestTrimStartMs(peaks, duration_ms)` → instant client-side silence detection
  - `isUntrimmed(take)`, `trimLine(take)`, `setTakeTrim`, `clearTakeTrim`

## UX to build

### 1. Playback honours the trim — everywhere, silently
Every player in the room (take card, mini-player, Listen Path, Compare Mode, Performance
mode) must:
- set `audio.currentTime = playWindow(take).startSec` on load,
- stop / advance at `endSec` if present,
- render duration as `lengthMs`, not raw `duration_ms`.
No badge, no note, no explanation. The take just starts where the music starts.

### 2. The offer, not the tool
When a take is saved and `suggestTrimStartMs()` returns > 700ms, show one calm line under
the new take card:

> Starts 3s in. **Trim the silence**

Tapping it calls `setTakeTrim(id, suggested)` immediately — optimistic, no sheet, no
confirm. The line becomes:

> Trimmed. **Undo**

`Undo` calls `clearTakeTrim`. The line fades out after ~8 seconds or on next interaction.
If the suggestion is under 700ms, say nothing at all.

### 3. Manual trim lives in the take's contextual menu only
Long-press / `…` on a take → "Trim silence". Opens a short sheet:
- The existing gold waveform, full width, single row.
- One gold handle on the left edge, pre-placed at the suggestion.
- Everything before the handle renders at 30% opacity (charcoal, not red).
- Tap anywhere on the waveform to move the handle there; drag to fine-tune.
- Playback preview auto-starts from the handle whenever it moves (debounce 200ms).
- Footer: `Keep` (gold, full-width) and a small text link `Use the whole take`.
- An end handle appears **only** after the user drags the right edge inward — it is not
  shown by default. Most people never need it.

### 4. Card affordance
On a trimmed take card, show `trimLine(take)` as a single 0.75rem warm-gray line under
the friendly name. Nothing else marks it. No icon, no chip.

## Performance requirements
- Trim state must be part of the take payload already in cache — never a second fetch.
- `setTakeTrim` is optimistic: update the local take, adjust the audio element in the same
  frame, reconcile on the RPC's returned row. On failure, revert and toast once.
- `suggestTrimStartMs` runs off the peaks already in memory. Zero network, under 1ms.
- The trim sheet must open in under 100ms — reuse the mounted waveform, do not re-decode
  audio.

## Explicitly out of scope
- Destructive re-encoding, fades, normalisation, noise reduction.
- Trimming from the feed.
- Any trim UI on the catalog or workspace hub.

## Definition of done
1. Every player in the room starts and stops inside the trim window.
2. A fresh take with leading silence offers one line and one tap to fix it.
3. Undo is always one tap and always restores the original in full.
4. Nothing about this feature is visible on takes that don't need it.
