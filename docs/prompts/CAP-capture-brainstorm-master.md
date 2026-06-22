# CAP — CAPTURE / BRAINSTORM MASTER (the #1 priority)
## Make catching an idea frictionless, and make that idea song-ready in seconds
## Lanes: Claude (UI) · Lovable (transcription + music AI) · Fable 5 standard

> The product's heartbeat. A worship songwriter must be able to **tap once, sing the
> idea, and have it become a near-complete song** — sections, lyrics, chords, key, BPM —
> with almost no manual work. CapCut-fast, Voice-Memos-reliable, Apple-calm.

---

## WHAT'S ALREADY DONE (verified — build ON this, don't redo)
- **Tap-to-record mic** (hardened): iOS AudioContext resume, no-timeslice blobs,
  interruption/ceiling/page-hidden **auto-save**, permission + secure-context diagnosis,
  failed-upload retain+retry, on-brand review player, listening pulse. (`useVoiceRecorder`,
  `CaptureScene`, `BigMic`, `ReviewAudioPlayer`, 6 passing recorder tests.)
- **Keyword → section routing (the AI the songwriter wants):** `src/lib/capture/
  sectionKeywords.ts` scans the transcript and, when you say "verse one / chorus /
  bridge / intro / pre-chorus / hook / tag / outro / interlude", routes **everything
  after it into that section until the next keyword** — absorbing ordinals ("verse two",
  "verse 1") and filler ("okay chorus", "and now the bridge"). `buildTranscriptBlocks`
  splits one memo into section blocks. Tested (`sectionKeywords*.test.ts`). **This works.**
- **Chords:** `ChordPicker` (Nashville numbers, diatonic + borrowed, quality/extension/
  slash, letters↔numbers, a BPM field). **Section markers** + live transcript with dividers.

---

## WHAT TO BUILD / ENHANCE

### Claude (UI lane)
1. **Tap-Tempo BPM (NEW — execute now):** a "Tap" control that sets BPM from the
   songwriter's taps (avg of recent intervals, reset after a pause, live readout,
   haptic, ≥44px). Wire into `ChordPicker`'s BPM field so BPM is one tap, not typing.
2. **Extend keyword routing** in `sectionKeywords.ts` for **letter suffixes** ("verse 1a",
   "chorus 2", "verse 1 b") and a few more synonyms (e.g. "refrain"→chorus, "vamp"→tag,
   "turnaround"→bridge). Keep it pure + tested.
3. **"Make it a song" flow:** from a captured idea, one tap turns the section blocks +
   detected key/BPM/chords into a real song (room with sections prefilled). Minimize steps.
4. **Inline section editing in review:** rename/reorder/merge the auto-detected sections,
   correct a mis-heard keyword, attach the memo to a section — fast, mobile.
5. **Count-in + optional metronome while recording** (F14) so a hummed idea is in time;
   pairs with tap-tempo.
6. **Frictionless speed everywhere:** instant mic start, no spinners, optimistic UI,
   thumb-reachable, the prompt → record → review path ≤ a few taps. Meet `MOBILE-UX-BENCHMARK.md`.

### Lovable (backend lane — see LX/L3/L5)
7. **Always-on auto-transcribe (no Pro gate now):** transcription runs for every take by
   default (the user explicitly wants this ungated). Word timestamps for the routing above.
8. **Auto key / BPM / chord detection** from the hum (Moises/Music.ai cloud or Essentia
   on-device) → prefill the song's key, BPM, and chord chips so tap-tempo is a *correction*,
   not the only source.
9. **Audio enhancement** (Dolby.io) so rough phone hums come back clean.

---

## THE GOLDEN MOMENT (the bar)
Tap gold mic → "Verse one, [sing]… chorus, [sing]…" → stop → review shows **Verse 1**
and **Chorus** already split with lyrics, the **key + BPM auto-detected**, **chords**
suggested, tap-tempo to fine-tune → one tap **"Make it a song."** Under ~20 seconds,
almost no typing.

## ACCEPTANCE (this master)
- [x] Tap-tempo sets BPM by tapping; live readout; resets after a pause; ≥44px; haptic.
- [x] Keyword routing handles letter suffixes + the added synonyms (tested).
      `sectionKeywords.ts`: ordinals on **every** section ("chorus 2", "bridge 2"),
      letter variants ("verse 1a", "verse 1 b" → Verse 1A/1B), synonyms
      ("ending"/"coda"→outro, "refrain"→chorus, "vamp"→tag, "turnaround"→bridge,
      "breakdown"→interlude). 14 new tests in `sectionVariants.test.ts`.
- [x] Count-in + click while recording (`useMetronome` + `MetronomeBar`): a 4-beat
      count-in resolves on the downbeat, then a steady look-ahead-scheduled click
      runs through the take. Off by default; tap-tempo / ± set the BPM. iOS:
      AudioContext primed + resumed in the tap gesture; clicks play *before* the
      live transcript starts so they aren't transcribed.
- [ ] Auto-transcribe is on for every take (Lovable); key/BPM/chords prefill (Lovable).
- [ ] "Make it a song" turns a reviewed idea into a sectioned song in one tap.
      (Path exists via ReviewSheet → `commitTakeToCanvas`; BPM-into-song wiring is
      Lovable's intake lane.)
- [x] Whole capture→song path meets the mobile benchmark; `tsc`(my files)+`build`+tests green.

## REFERENCES
- `src/components/capture/*` (`CaptureScene`, `BigMic`, `ChordPicker`, `ReviewAudioPlayer`, `LiveTranscript`)
- `src/lib/capture/{sectionKeywords,transcriptModel,acousticSplits}.ts` + tests
- `src/hooks/useVoiceRecorder.ts`, `src/integrations/cog/{transcript,intake,storage}.ts`
- `docs/prompts/LX-…capture-ai-intelligence.md`, `L3-…intake-transcription.md`, `MOBILE-UX-BENCHMARK.md`
- Features F8/F9/F12/F13/F14 in `zip_extracted/…/3. System operations/`
