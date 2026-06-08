## Goal
Let users import an existing voice memo from their phone (iOS Voice Memos `.m4a`, Android recorder `.m4a`/`.amr`/`.3gp`, or any `audio/*` file) on the Capture scene, then run the **same** transcription + section-splitting pipeline that ships today — so the Review Sheet opens with verse/chorus blocks ready to commit to canvas.

## What's already in place (do not rebuild)
- `submitSharedAudio` (SDK) → `intake-voice-memo` (edge fn) already accepts any `audio/*` file ≤50MB, validates membership, uploads to `voice-memos`, creates the `voice_memo` + primary `take` row, and counts bytes against the owner's storage.
- `requestTranscript` + `transcribe-take` already perform server-side section splitting from spoken cues ("verse one", "chorus", etc.) and write `transcript_json.blocks` on the take.
- `ReviewSheet` already auto-polls until transcript is ready, renders editable blocks, and commits to canvas.
- `CaptureScene` already has the post-record handoff (create song → upload → fetch take id → open Review Sheet); we just need to call the same path with an imported file.

So **this is a frontend-only change** + a small refactor inside `CaptureScene.tsx`. No new edge functions, no SDK changes, no schema work.

## UX
Below the mic, when idle (not recording), show a single quiet pill:

```
        ◯
       MIC
       0:00

   ⤓  Import a voice memo
```

- Icon: `Upload` (lucide), 16px.
- Style: ghost button — transparent background, 1px gold border `rgba(184,149,58,0.30)`, charcoal text, 11px serif, `border-radius: 999px`, `padding: 8px 14px`.
- Hidden while recording or while a take is being saved (`saving === true`).
- Tapping triggers a hidden `<input type="file" accept="audio/*" />` (no `capture` attr, so iOS opens the full Files picker which exposes Voice Memos via the Files app and "Browse" → "On My iPhone" → "Voice Memos").

On file pick:
1. Client-side guard: size > 50MB → toast error, abort. Mime not starting with `audio/` → toast error, abort.
2. Best-effort: read duration via an off-DOM `<audio>` element + `URL.createObjectURL` (so the Review Sheet header shows the right `mm:ss`). Fall back to 0 on failure — non-blocking.
3. Call the existing post-record path (extracted into a shared helper, see below).

## Implementation

### Refactor in `src/components/capture/CaptureScene.tsx`
Extract the inner body of `handleMicTap`'s "stop recording" branch (lines that create the song, call `submitSharedAudio`, fetch take id + storage_path, open Review Sheet) into a new memoized helper:

```ts
const handleAudioFile = useCallback(async (file: File, durationMs: number) => {
  // existing logic: ensure song, submitSharedAudio, getPrimaryTakeIdForMemo,
  // fetch storage_path, setReview({...})
}, [songId, songTitle]);
```

Then:
- The mic stop branch calls `handleAudioFile(new File([blob], ...), result.durationMs)` — same behavior as today.
- The new import button calls `handleAudioFile(pickedFile, measuredDurationMs)`.

### New component `src/components/capture/ImportMemoButton.tsx`
- Owns the hidden `<input ref>` and the visible pill button.
- Props: `disabled: boolean`, `onPicked: (file: File, durationMs: number) => void | Promise<void>`.
- Measures duration via:
  ```ts
  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = URL.createObjectURL(file);
  await new Promise<void>((res) => {
    audio.onloadedmetadata = () => res();
    audio.onerror = () => res();
    setTimeout(res, 1500); // hard timeout
  });
  const durationMs = isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
  URL.revokeObjectURL(audio.src);
  ```
- Resets `input.value = ""` after each pick so the user can re-import the same file.

### Hook it into `CaptureScene.tsx`
Inside the `<main>` block, just under the partial transcript / pending-blocks notice, render:

```tsx
{phase !== "recording" && !saving && !review.open && (
  <ImportMemoButton
    disabled={saving}
    onPicked={(file, dur) => handleAudioFile(file, dur)}
  />
)}
```

Set `setStatus("transcribing")` and `setSaving(true)` inside `handleAudioFile` so the existing busy UI (status copy, disabled mic) covers both paths.

### Toast strings
- Success: rely on existing "Started a new song" toast in `handleAudioFile` + the Review Sheet opening as confirmation.
- Size error: `"That file is bigger than 50MB."` (matches edge-fn cap).
- Mime error: `"Only audio files can be imported."`
- Edge-fn 403 (not a member): `"You're not a member of this song."` — already surfaced by existing catch.

## Notes & explicit non-goals
- **No new "Unfiled inbox" view.** The imported file flows into the same song the user is currently on (or a freshly-created "New idea · Dec 8 · 3:42 PM" song if none) — identical to a recorded take.
- **No live transcript pane** during import — there's nothing live to show. The Review Sheet handles polling + display, exactly like the post-record path.
- **No drag-and-drop on mobile** in this pass. (Possible follow-up for desktop.)
- **No iCloud-specific picker tweaks.** iOS handles Voice Memos via the standard Files picker that `<input type="file" accept="audio/*">` already opens.
- **No changes to `intake-voice-memo` or `transcribe-take`.** The 50MB cap and `audio/*` filter already cover iOS m4a (`audio/mp4`/`audio/m4a`/`audio/x-m4a`) and Android m4a/amr/3gp.

## Files
- New: `src/components/capture/ImportMemoButton.tsx`
- Edit: `src/components/capture/CaptureScene.tsx` (extract `handleAudioFile`, render the button)

## Verification
1. Open `/capture` on mobile, idle. The "Import a voice memo" pill appears under the duration counter.
2. Tap → Files picker opens → pick a `.m4a` from Voice Memos → Review Sheet opens with "Listening back to your take…" shimmer.
3. After server transcription returns, blocks appear (sections split if the recording included spoken "verse one"/"chorus" cues).
4. "Add to canvas" navigates to `/songs/:id/canvas?from=capture` exactly like a recorded take.
5. Re-importing the same file works (input value resets).
6. Files > 50MB show a friendly toast and never upload.
