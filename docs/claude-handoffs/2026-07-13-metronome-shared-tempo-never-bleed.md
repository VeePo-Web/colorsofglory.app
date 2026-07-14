# The Click That Never Bleeds + One Shared Tempo — build handoff

**Date:** 2026-07-13 · **Lane:** C4 (audio engine) · **Shipped to:** `main`

## What landed

The COG metronome, re-architected around one hard invariant:

> **While the microphone is armed, nothing plays through the speaker.** An
> audible click — or an audible base-take guide during "record over this" —
> is allowed ONLY into a **confirmed** headphone/earbud output. Otherwise the
> metronome is **visual (gold beat pulse) + haptic**, preceded by an audible
> **count-in that fully decays before the mic opens.**

Bleed is acoustic (speaker → air → mic). No audio-graph routing, no
`setSinkId`, and no `echoCancellation` can prevent it — only headphones or
not making the sound. Do not "fix" this with AEC or node-routing tricks.

### The pieces

| File | Role |
|---|---|
| `src/lib/audio/audioSession.ts` | The authority both the metronome and recorder consult: `recordingArmed`, best-effort `outputRoute` (enumerateDevices + devicechange; iOS = unknown → treated as speaker), persisted "I'm on earbuds" confirmation, and the derived `clickMode` / `canPlayReferenceAloud`. Unplugging mid-take drops the route instantly. |
| `src/lib/audio/metronome.ts` | The ONE engine (the `Metronome` class the canvas F14 toggle and the practice player already construct — this pass grafted the invariant into it rather than shipping a second engine). The scheduler and visual queue never stop; only the **sound** is gated per-click on the session, and a flip-to-silent mutes clicks already queued in the lookahead window. Count-in plays one bar, fires `onCountInDone` on the audio clock as the first real beat lands, and the click continues seamlessly on the same grid — bleed-safe because arming the session mutes any speaker click in the same tick, and the mic stream only opens after `getUserMedia` resolves (~100–300ms of real silence later). |
| `src/hooks/useVoiceRecorder.ts` | Arms/releases the session at the exact mic boundary (before `getUserMedia`; released in the single cleanup choke point every stop path uses). New opt-in `highFidelity` disables AEC/NS/AGC for musical takes — safe only because bleed is prevented structurally. |
| `src/hooks/useAudioSession.ts` / `useMetronome.ts` | React views over the store + engine. `useMetronome` keeps the original capture-hook API (`prime/countIn/start/stop/supported`) but now drives the gated class — so CaptureScene's `countIn → record → start(click)` flow (previously a straight speaker click into the take) became bleed-safe without touching CaptureScene. A surface that started the click never leaves it running after unmount. |
| `src/components/voice/BeatPulse.tsx` / `MetronomeStrip.tsx` | The silent metronome: audio-clock-driven gold pulse (downbeat weighted, reduced-motion safe), haptic on beat (Android; iOS no-ops), calm "Click: visual — put on earbuds to hear it" honesty, and the earbuds toggle in the recording sheet. |
| `src/hooks/useSongTempo.ts` + `cog/songs.updateSongTempo` + `cog/realtime.subscribeSongTempo` | One shared `songs.tempo_bpm` per song, read by every collaborator's metronome and propagated live. **Async tempo alignment, not real-time click sync** — takes align because they share a BPM and a bar-1 count-in, never because clocks are network-locked. Tap-tempo (and F13 detection, when it lands) are proposals; only the explicit "Set" confirm writes the canonical value. UI gates editing to owner/collaborator; RLS stays the real gate. |
| `src/components/voice/TempoRow.tsx` | The pre-record transport at the record-over moment (stack sheet): tap-tempo → confirm, count-in toggle, earbuds confirmation. |
| `src/lib/audio/referenceGuide.ts` | The F16 audible guide, gated on confirmed headphones and self-silencing if the route flips mid-take. Returns playback start + a device round-trip estimate (`baseLatency` + `outputLatency` + mic-path constant). |
| `src/lib/audio/alignmentStore.ts` + `useStackPlayer` | The measured offset is stored per layer (client-side for now) and applied on stack playback (`layer.currentTime = base + offset`), fixing the "all layers start at time=0" drift. Offsets follow a queued take from temp id → real memo id. |
| Canvas wiring (`SongCanvasExperience`) | Count-in → mic → click-through-take → guide (headphones only) → offset captured on save → rekeyed on upload reconcile. Guide + click are torn down on Stop/cancel AND on interruption auto-finalize. |

## Backend asks (Lovable lane)

1. **`voice_memos.parent_memo_id uuid null`** — the layer relationship is still
   client-held; `voice-memo-upload-url` already receives `parent_memo_id` and
   ignores it. Persisting it makes stacks durable across devices.
2. **`voice_memos.alignment_offset_ms int null`** — accept it in
   `voice-memo-upload-url`/`voice-memo-finalize`. The client already measures
   it; `src/lib/audio/alignmentStore.ts` becomes the offline cache in front of
   the column once it exists.
3. **Realtime publication for `songs`** — `subscribeSongTempo` listens for
   `UPDATE` on `public.songs` filtered by id. Confirm the `songs` table is in
   the `supabase_realtime` publication (the room tables already stream); if it
   isn't, tempo changes won't propagate live (clients still read the fresh
   value on next open).
4. **RLS check** — `updateSongTempo` does a direct `songs.tempo_bpm` update.
   Confirm collaborators (not just owners) may update this column, or scope a
   narrow policy/RPC for it; the UI already hides the control from viewers.

## Consumer convergence notes

All three consumers now sit on the one gated engine (this landed mid-flight:
the capture suite, the canvas F14 toggle, and the practice player all merged
to main while this pass was in review, each with an ungated click — the
rebase unified them):

- **Capture (C2):** `CaptureScene`'s `useMetronome` is now the wrapper over
  the gated class — its click during recording is silent on a speaker /
  audible on confirmed earbuds, unchanged code. Follow-up: `MetronomeBar`'s
  tap-tempo still holds a scene-local BPM; feed it `useSongTempo.saveTempo`
  when a song is in context so capture proposes to the same shared tempo.
- **Canvas (D2):** the F14 jam toggle (`useCanvasMetronome`) constructs the
  gated class and already hard-stops at record-start; its debounced
  `persistSongTempo` now writes through `cog/songs.updateSongTempo`, so the
  jam toggle and the record-flow transport share one canonical BPM + realtime
  channel. The record/record-over flow (count-in, click-through-take, guide,
  alignment) wired in this pass.
- **Practice (F2):** `usePracticePlayer` constructs the gated class for its
  count-in + steady click and ramps `setBpm` live (speed trainer) — live-ramp
  safe by design, now also incapable of bleeding into any armed recording.

## Bleed-test checklist (manual, on hardware)

1. Speaker + click on → record: the saved take contains **no click** (it went
   visual the instant the mic armed). The gold pulse + status line showed.
2. Count-in on, speaker: one audible bar, real silence, then the mic opens —
   the count-in is never in the take.
3. Earbuds confirmed → record: click audible in the phones, take clean.
4. Unplug earbuds mid-take: click goes silent immediately (devicechange →
   route drop → scheduled clicks muted); the take keeps recording.
5. Set tempo on phone A → phone B's open room updates its BPM live (needs
   backend ask #3).
6. Record-over with earbuds: base + click audible as the guide; saved layer
   plays back seated on the base's grid (offset applied in the stack player).

## What could not be verified here

Real-hardware acoustics (jsdom has no audio path): items 1–6 above need a
physical iPhone + Android pass. Everything code-verifiable is verified:
`tsc --noEmit` clean, `vite build` green, 25 new unit tests green (invariant
derivation, count-in guard gap across the BPM range, alignment store), canvas
suite green. Pre-existing failures on main (`song-catalog-hero`,
`codex-mobile-render`, `cog-phone-otp-send`) were confirmed pre-existing via a
clean-tree run and are untouched by this work.
