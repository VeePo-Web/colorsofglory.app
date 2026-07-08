# C4 — Voice Memo Agent · Engine Ownership Map

**Canonical voice home:** `/songs/:id/voice` → `src/pages/VoiceMemosPage.tsx` (app shell + `RequireAuth`).
Chosen because it is the only surface with the full recorder flow (record → review → save), take
versions, layered stacks, and import. The canvas `?layer=voice` panel (`VoiceLayerPanel`) remains a
consistent embedded view of the same memo list/data — it is NOT the front door.

## C4-owned engine layer (shared primitives — consumers import, never fork)

| File | Role |
|---|---|
| `src/hooks/useVoiceRecorder.ts` | THE recorder. Mic-in-gesture AudioContext resume, auto-finalize on interruption/ceiling/page-hide, 0-byte guard. |
| `src/lib/audio/metronome.ts` | Lookahead-scheduler click engine (F14). Live BPM/time-sig changes, count-in. |
| `src/lib/audio/waveformPeaks.ts` | Real playback peaks: compute-once at capture/import, resample for render. |
| `src/lib/audio/volumeNormalizer.ts` | OfflineAudioContext peak analysis → normalization gain. |
| `src/lib/voice/captureOutbox.ts` | THE durable save path. Blob → IndexedDB BEFORE network, retry on reconnect/heartbeat/load. |
| `src/lib/voice/saveMemo.ts` | `saveMemoDurable` — the one canonical save API every voice surface calls. |
| `src/lib/voice/audioCache.ts` | IndexedDB blob cache (instant first play). |
| `src/lib/voice/stackModel.ts` | Layered stacks (F16): base + child layers via `parentMemoId`. Orphan layers promote to bases. |
| `src/lib/voice/voiceApi.ts` | In-song upload pipeline (signed URL → PUT → finalize) + memo list with real section labels. |
| `src/hooks/useStackPlayer.ts` | Synchronized stack playback, mute/solo. |
| `src/integrations/cog/{takes,memos,player,intake}.ts` | A3 data access for takes/memos/player contract/share intake. |
| `src/components/voice/*` | Voice surfaces: recorder sheets, stack, take mini-player, section dock, import. |

## NOT C4's (do not edit from the voice lane)

- `src/lib/audio/practiceTypes.ts`, `practiceStorage.ts`, `mediaSessionBridge.ts` → **F2 (Practice)**.
  They live in `/lib/audio/` but belong to the practice player, as does
  `src/components/practice/*` (global mini practice player).
- Lyric/transcript/chord **text** rendering → C2 (capture review) / C3 (sheet editor). C4 stops at audio.
- Canvas card visuals + placement (`src/components/canvas/*Card.tsx` layout) → D2. C4 supplies data,
  playback, and real `waveform_peaks`; D2 renders them on the canvas.
- Canvas "record over this" orchestration (`recordingParentMemoId` → save in `SongCanvasExperience`) → D3.
- Hold-to-hum gesture (F9) → a canvas gesture (D2/D3) that CONSUMES `useVoiceRecorder`.

## Locked decisions (protected in code comments)

- **Gold, never red** while recording (`RecordingWaveform.goldWaveColor`).
- **Tap-to-start / tap-to-stop** on the primary mic — no press-and-hold (races the tap, orphans takes).
- **Versions (`takes.ts`) ≠ layers (`stackModel.ts`)** — never merged.
- **Nothing is ever lost**: every save routes through `captureOutbox` (cache-first ordering is the guarantee).

## Seams left for other agents

- **C2**: `submitSharedAudio` (cog/intake.ts) is called directly by CaptureScene, bypassing the outbox —
  seam note at the function. Switch to `saveMemoDurable`/`enqueueCaptureUpload`.
- **C3**: `SectionVoiceDock` + `saveSectionMemo` are the audio-only per-section embed.
- **D3**: `SongCanvasExperience`'s record-over save still uses the deprecated `pendingUploads` —
  migrate to `saveMemoDurable({ parentMemoId })`, then delete `pendingUploads.ts` + its test.
