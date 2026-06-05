# Step 3 — Voice Memo Recording System
## In-Depth Implementation Plan
## Fantasy.co × World-Class Audio UX
## 2026-06-04

---

## THE BIG VISION

Voice is the most important feature in the app. A songwriter hums a melody at 11pm. Right now, that idea goes into the iPhone Voice Memos app, gets buried, and is forgotten by morning. Colors of Glory makes the path from idea → captured → connected to song so frictionless that no idea ever dies again.

Three capture modes, one visual language:
1. **Record now** — mic button in the canvas toolbar, instant start, bottom sheet with live waveform
2. **Upload existing** — drag/drop on desktop, file picker on mobile (MP3, WAV, M4A, WEBM)
3. **Import from phone** — iOS Files app (which includes Voice Memos folder), Android Files, any audio file from any cloud provider

All three produce the same output: a `VoiceMemoCard` on the Ideas Tree with a waveform, playback controls, and optionally a transcript.

---

## LOCKED DECISIONS (20 questions answered)

| Decision | Choice |
|----------|--------|
| Trigger | Dedicated mic button in canvas bottom toolbar |
| Tap behavior | Single tap → starts recording immediately |
| Recording UI | Bottom sheet slides up over frosted glass canvas |
| Canvas during recording | Dimmed to 20% behind frosted overlay |
| Max duration | No limit — user controls Stop |
| Recording sheet content | Waveform + red timer + Stop + section chip + note field |
| Section chip | "Saving to: Verse 1" with tap-to-change picker |
| Live waveform | Real AnalyserNode data, averaged over 3 frames (smooth) |
| Waveform bars during recording | Amber → coral gradient matching reference image |
| Post-stop state | Quick-action bottom sheet: Play / Rename / Section / Transcribe? / Save |
| Sheet dismissal | Auto-dismisses after 2 seconds, VoiceMemoCard pulses gold on canvas |
| Card placement | Always Ideas Tree — user decides if it goes to Final |
| Card state during processing | Instant card with "Processing..." chip (no progress bar) |
| iPhone import | iOS Files picker (includes Voice Memos folder as a location) |
| Android import | Android Files picker |
| Desktop | Drag-and-drop onto Voice layer panel |
| Audio format | Auto-detect: webm/opus on desktop, mp4/aac on iOS Safari |
| Storage | Supabase Storage bucket (use existing voice-memo-upload-url edge function) |
| Transcription | Optional toggle in review sheet ("Transcribe to lyrics draft?" — Pro only) |
| Playback | Progressive: stream from signed URL immediately, cache to IndexedDB |
| Playback permissions | All song members can play all memos |
| Permission denied | Warm inline message in bottom sheet + "Open Settings →" deep link |
| Navigation interruption | beforeunload warning: "Leave? Recording will stop." |
| Recording interruption | Partial audio saved automatically |
| Voice memo list | Chronological list, newest at top, grouped by section |

---

## SYSTEM ARCHITECTURE

### Files to create

```
src/
  hooks/
    useVoiceRecorder.ts        ← MediaRecorder + AnalyserNode + upload orchestration
    useAudioPlayer.ts          ← playback with IndexedDB caching

  components/
    voice/
      RecordingSheet.tsx       ← the bottom sheet that appears during recording
      RecordingWaveform.tsx    ← live AnalyserNode waveform bars (rAF at 60fps)
      RecordingTimer.tsx       ← red timer display (0:00 → N:NN)
      SectionChip.tsx          ← "Saving to: Verse 1" chip with picker
      VoiceReviewSheet.tsx     ← post-stop review: play/rename/section/transcribe
      VoiceLayerPanel.tsx      ← the Voice layer panel with list + upload zone
      VoiceMemoListItem.tsx    ← single memo row in the panel list
      UploadDropZone.tsx       ← drag-and-drop zone for desktop

  lib/
    voice/
      voiceApi.ts              ← upload (via edge function), getSignedUrl, transcribe
      audioCache.ts            ← IndexedDB caching for playback blobs
      audioFormat.ts           ← format detection (webm vs mp4)
```

### Edge functions already deployed by Lovable

```
supabase/functions/
  voice-memo-upload-url/index.ts     ← generates signed upload URL
  voice-memo-finalize/index.ts       ← called after upload to create DB record
  voice-memo-signed-url/index.ts     ← generates playback signed URL
  voice-memo-transcribe/index.ts     ← triggers Whisper transcription
  voice-memo-delete/index.ts         ← delete memo and storage file
```

---

## HOOK: `useVoiceRecorder.ts`

The engine of the whole feature. Manages the complete recording lifecycle.

```typescript
interface VoiceRecorderState {
  phase: 'idle' | 'requesting-permission' | 'permission-denied' | 'recording' | 'stopping' | 'processing' | 'error';
  durationMs: number;        // updated every 100ms during recording
  analyserNode: AnalyserNode | null;  // for waveform data
  error: string | null;
}

interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult>;
  cancelRecording: () => void;
}

interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}
```

### Implementation

```typescript
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    // 1. Request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } });
      streamRef.current = stream;
    } catch (err) {
      // Permission denied → set phase to 'permission-denied'
      if ((err as DOMException).name === 'NotAllowedError') {
        setState(s => ({ ...s, phase: 'permission-denied' }));
        return;
      }
      throw err;
    }

    // 2. Set up Web Audio AnalyserNode for real-time waveform
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(streamRef.current);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;  // the 3-frame average effect
    source.connect(analyser);
    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    // 3. Start MediaRecorder with best supported format
    const mimeType = getBestMimeType();  // see audioFormat.ts
    const recorder = new MediaRecorder(streamRef.current, { mimeType, audioBitsPerSecond: 128000 });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(100);  // collect data every 100ms for responsive chunks
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();

    // 4. beforeunload warning
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    setState(s => ({ ...s, phase: 'recording', analyserNode: analyser }));
  };

  const stopRecording = async (): Promise<RecordingResult> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;
      const mimeType = recorder.mimeType;

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Date.now() - startTimeRef.current;

        // Clean up
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
        window.removeEventListener('beforeunload', handleBeforeUnload);

        resolve({ blob, mimeType, durationMs });
      };

      setState(s => ({ ...s, phase: 'stopping' }));
      recorder.stop();
    });
  };
}
```

---

## `getBestMimeType()` — `audioFormat.ts`

```typescript
const PREFERRED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',           // iOS Safari fallback
];

export function getBestMimeType(): string {
  for (const type of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';  // browser default
}

export function getFileExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'audio';
}
```

---

## COMPONENT: `RecordingSheet.tsx`

The bottom sheet that appears during active recording. Slides up from below. Canvas behind it dims to 20%.

### Visual specification

```
Position: fixed bottom-0, full-width, z-index 800
Height: 340px (fixed — no dynamic sizing during recording)
Background: #FAFAF6
Border-radius: 24px 24px 0 0
Border-top: 1px solid rgba(0,0,0,0.08)
Box-shadow: 0 -24px 60px rgba(0,0,0,0.20)

Animation: slides up from bottom
  from: translateY(100%)
  to:   translateY(0)
  350ms cubic-bezier(0.22, 1, 0.36, 1)

FROSTED BACKDROP:
  position: fixed inset-0 z-799
  background: rgba(26,26,26,0.65)
  backdrop-filter: blur(12px)
  opacity animates from 0 → 1 in 300ms
```

### Sheet layout (top to bottom)

```
[Handle bar] — 4px × 40px, #CCC, centered, 12px from top

[Section chip] — centered, 20px below handle
  "Saving to: Verse 1" or "Saving to: Raw idea"
  Tappable: opens section picker sheet
  Style: rounded-full, creator-color bg15, creator-color text

[Note field] — 40px below chip
  Placeholder: "Add a label while you record..."
  Width: full-width minus 40px padding
  Style: borderless, transparent bg, Inter 14px, #666
  Returns key: dismisses keyboard but keeps recording

[WAVEFORM] — centered vertically in remaining space
  40 bars, 4px wide, 3px gap
  Heights: from AnalyserNode.getByteFrequencyData() averaged over 3 frames
  Color gradient: LEFT #D4AE5C → MID #C88040 → RIGHT #E05440
  Max height: 80px
  Animated at 60fps via requestAnimationFrame

[TIMER] — 28px below waveform
  Font: Inter 700, 52px, tabular-nums
  Color: #E05440 (red)
  Updates every 100ms: "0:00" → "1:34" → "N:NN"

[Recording...] — 8px below timer
  Inter 400, 14px, #999

[STOP BUTTON] — 32px below label
  Width: 180px
  Height: 52px
  Border-radius: 9999px (pill)
  Background: #E05440
  Color: #FFFFFF
  Font: Inter 700, 16px
  Shadow: 0 4px 16px rgba(224,84,64,0.40)
  Active: scale(0.97), 120ms

[Safe area] — env(safe-area-inset-bottom) padding below
```

---

## COMPONENT: `RecordingWaveform.tsx`

The live waveform. Uses `requestAnimationFrame` — never causes React re-renders during animation.

```typescript
const RecordingWaveform = ({ analyserNode, barCount = 40 }: { analyserNode: AnalyserNode | null; barCount?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyserNode || !containerRef.current) return;

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const prevHeights = new Float32Array(barCount).fill(0.1);

    function draw() {
      analyserNode!.getByteFrequencyData(dataArray);

      // Map frequency data to bar heights with smoothing
      const step = Math.floor(dataArray.length / barCount);
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const freq = dataArray[i * step] / 255;
        // 3-frame lerp average (smoothingTimeConstant=0.8 in analyser + this lerp)
        prevHeights[i] = prevHeights[i] * 0.65 + freq * 0.35;
        const h = Math.max(0.06, prevHeights[i]);
        bar.style.height = `${h * MAX_BAR_HEIGHT}px`;

        // Color gradient: amber (left) → coral (right)
        const t = i / (barCount - 1);
        const r = Math.round(212 + t * 16);
        const g = Math.round(174 - t * 90);
        const b = Math.round(92 - t * 28);
        bar.style.backgroundColor = `rgb(${r},${g},${b})`;
        bar.style.opacity = String(h * 0.7 + 0.3);
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode, barCount]);

  // Render divs — refs attached after mount
  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: MAX_BAR_HEIGHT, justifyContent: 'center' }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div key={i} ref={el => { if (el) barsRef.current[i] = el; }}
          style={{ width: 4, borderRadius: 3, backgroundColor: '#D4AE5C', height: 8, flexShrink: 0 }} />
      ))}
    </div>
  );
};

const MAX_BAR_HEIGHT = 80;
```

---

## COMPONENT: `VoiceReviewSheet.tsx`

Appears AFTER the user taps Stop. Replaces the recording sheet with a review UI.

```
Height: 340px (same as recording sheet — seamless visual transition)

Content (top to bottom):

[Handle bar]

[Golden checkmark or waveform preview]
  Compact static waveform (20 bars, gold, the just-recorded audio)
  Play button (36px gold circle) on the left

[Name field]
  Label: "Memo name"
  Value: auto-populated from note field text OR "Voice Memo {count}"
  Editable inline input

[Section picker row]
  "Save to:" label → current section chip → tap to change

[Transcribe toggle — Pro only]
  Toggle row: [Switch] "Auto-transcribe to lyrics draft"
  Subtitle: "Powered by AI · Takes ~30 seconds after saving"
  Locked with 🔒 for free users → tapping opens upgrade sheet

[Two buttons at bottom]
  [Discard] — ghost, #E05440 text — tapping discards recording
  [Save memo →] — full-width gold pill — triggers upload
```

### Upload flow on "Save memo →"

```typescript
async function handleSave() {
  setSaving(true);

  // 1. Get a signed upload URL from Lovable's edge function
  const { uploadUrl, memoId, storagePath } = await voiceApi.getUploadUrl({
    songId,
    mimeType: recording.mimeType,
    durationMs: recording.durationMs,
  });

  // 2. Immediately add card to canvas in "processing" state
  addCanvasCard({
    id: memoId,
    type: 'voice',
    title: memoName || `Voice Memo ${memoCount + 1}`,
    section: selectedSection,
    contributor: currentUser.displayName,
    status: 'raw',
    duration: formatDuration(recording.durationMs),
    isProcessing: true,  // shows "Processing..." chip instead of waveform
    tree: 'ideas',
    x: ..., y: ...,  // position in Ideas Tree
  });

  // 3. Upload blob to Supabase Storage via signed URL
  await fetch(uploadUrl, {
    method: 'PUT',
    body: recording.blob,
    headers: { 'Content-Type': recording.mimeType },
  });

  // 4. Finalize (creates DB record, triggers transcription if requested)
  await voiceApi.finalizeMemo({ memoId, storagePath, transcribe: wantsTranscribe });

  // 5. Update card: remove "processing" state, real waveform loads
  updateCanvasCard(memoId, { isProcessing: false, audioUrl: await voiceApi.getSignedUrl(memoId) });

  // 6. Sheet auto-dismisses, card pulses gold on canvas
  onSaved(memoId);
}
```

---

## COMPONENT: `VoiceLayerPanel.tsx`

Accessed via the "Voice" layer chip. Slides in as a right-side drawer (same drawer system as other layers).

### Panel layout

```
HEADER:
  [Mic icon] Voice Memos
  [+ Record] button — triggers recording
  [↑ Upload] button — triggers file picker

UPLOAD ZONE (desktop only):
  Dashed border area: "Drag audio files here"
  Accepts: .mp3, .wav, .m4a, .webm, .ogg, .aac
  On drop: shows upload progress, adds card to canvas

MEMO LIST (chronological, newest first, grouped by section):

  VERSE 1 ────────────────────
  [waveform] First melody hum      0:42 Parker
  [waveform] Verse hook attempt    1:14 Sarah
  [waveform] Chord scratch pad     0:28 Parker

  CHORUS ──────────────────────
  [waveform] "Colors of glory"     2:06 Parker

  UNASSIGNED ───────────────────
  [waveform] Quick idea            0:12 You

Each memo row:
  Left: mini waveform bars (12px tall, creator color, 8 bars)
  Center: name (Inter 600 13px) + section + age
  Right: ▶ play button (28px circle, creator color)
  Long press: context menu (Rename / Move to section / Delete / Add to canvas)
```

### File picker upload (mobile)

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validate type
  const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/m4a'];
  if (!allowed.some(type => file.type.startsWith(type.split('/')[0]) || file.type === type)) {
    showError('That file type isn\'t supported. Try MP3, M4A, WAV, or WebM.');
    return;
  }

  // Size check (max 200MB for Pro, 20MB for Free)
  const maxBytes = isPro ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    showError(`File too large. Max size is ${isPro ? '200MB' : '20MB'}.`);
    return;
  }

  // Get duration from audio element before upload
  const durationMs = await getAudioFileDuration(file);

  // Proceed with same upload flow as recording
  await uploadAudioBlob(file, file.type, durationMs);
};

// Hidden file input
<input type="file" accept="audio/*" onChange={handleFileUpload} style={{ display: 'none' }} />
```

---

## PLAYBACK: `useAudioPlayer.ts`

Progressive streaming with IndexedDB cache.

```typescript
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const play = async (memoId: string, signedUrl: string) => {
    // Check IndexedDB cache first
    const cached = await audioCache.get(memoId);

    if (cached) {
      // Instant playback from cache
      const url = URL.createObjectURL(cached);
      loadAndPlay(url);
    } else {
      // Stream immediately from signed URL
      loadAndPlay(signedUrl);

      // Cache in background (don't await)
      audioCache.prefetch(memoId, signedUrl);
    }
  };

  const loadAndPlay = (url: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = url;
    audio.ontimeupdate = () => setProgress(audio.currentTime / (audio.duration || 1));
    audio.onended = () => { setIsPlaying(false); setProgress(0); };
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  return { play, pause: () => { audioRef.current?.pause(); setIsPlaying(false); }, isPlaying, progress };
}
```

---

## CANVAS INTEGRATION: How voice memos connect to the canvas

When a recording is saved, a `VoiceMemoCard` appears at a deterministic position in the Ideas Tree:

```typescript
function getNextCardPosition(existingCards: CanvasCard[]): { x: number; y: number } {
  // Start below the last card in Ideas Tree
  const ideasCards = existingCards.filter(c => c.tree === 'ideas' && !c.isDimmedReference);
  if (ideasCards.length === 0) return { x: 80, y: 200 };

  const maxY = Math.max(...ideasCards.map(c => c.y + 140)); // 140 = approx card height
  return { x: 80 + (ideasCards.length % 2) * 240, y: maxY + 20 };
}
```

**The card pulse animation after save:**
```css
@keyframes card-save-pulse {
  0%   { box-shadow: 0 4px 20px rgba(181,147,90,0.18); }
  40%  { box-shadow: 0 0 0 8px rgba(181,147,90,0.25), 0 4px 20px rgba(181,147,90,0.30); }
  100% { box-shadow: 0 4px 20px rgba(181,147,90,0.18); }
}
.card-save-pulse { animation: card-save-pulse 600ms ease both; }
```

---

## iOS / ANDROID IMPORT PATH (device-specific)

### iOS (Safari)
1. User opens Files app on iPhone (or any app that can share)
2. In Colors of Glory Voice panel: tap "Upload audio file" button
3. iOS `<input type="file" accept="audio/*">` opens the Files picker
4. **The Files picker includes "Voice Memos" as a location** (Apple added this in iOS 14+)
5. User navigates to Voice Memos folder, selects a memo
6. File comes through as `.m4a` — same upload path as any file

### Android
1. User opens Files / Google Drive / local storage on Android
2. In Colors of Glory Voice panel: tap "Upload audio file"  
3. Android file picker opens — user selects audio from any source
4. Comes through as `.mp3`, `.m4a`, or `.ogg` — same path

### Desktop
1. User drags audio file from Finder/Explorer onto the Voice layer panel
2. Dashed drop zone highlights on hover
3. File drops → same upload path

### No special integration needed
No iOS Share Extension. No Android intent filter. No custom URI scheme. The standard `<input type="file" accept="audio/*">` on iOS will show Voice Memos as an option via the Files app. This is by design in iOS 14+.

---

## PERMISSION DENIED STATE

When the browser returns `NotAllowedError`:

```
RecordingSheet shows (instead of waveform):

  [🎤 icon — 48px, gold]

  "Microphone access is needed to record your ideas."

  "Colors of Glory can't hear your music without permission."

  [Open Settings →]   ← iOS: deep-links to app permission settings
                         Android: opens system app permissions
                         Desktop: shows Chrome settings URL with instructions
```

Deep link implementation:
```typescript
const openMicSettings = () => {
  // iOS: try the settings URL scheme
  const iosSettingsUrl = 'app-settings:';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    window.location.href = iosSettingsUrl;
  } else if (/Android/.test(navigator.userAgent)) {
    // Android can't deep-link to settings — show instructions
    showToast('Go to Settings → Apps → Colors of Glory → Permissions → Microphone');
  } else {
    // Desktop — Chrome settings
    showToast('Click the lock icon in the address bar → Site Settings → Microphone → Allow');
  }
};
```

---

## BEFORE UNLOAD GUARD

```typescript
useEffect(() => {
  if (phase !== 'recording') return;

  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome
    return ''; // Required for Firefox
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [phase]);
```

---

## STEP 3 ACCEPTANCE CRITERIA

**Recording:**
- [ ] Single tap on mic button → recording starts within 200ms
- [ ] Bottom sheet slides up with frosted glass over canvas
- [ ] Live waveform responds to real voice input via AnalyserNode
- [ ] Color gradient correct: amber left → coral right
- [ ] Red timer updates every 100ms in format M:SS
- [ ] Section chip shows current context, tap to change
- [ ] Note field accepts text while recording continues
- [ ] Stop button ends recording and transitions to review sheet
- [ ] beforeunload warning fires if user tries to navigate away

**Review sheet:**
- [ ] Static waveform preview of just-recorded audio
- [ ] Play button plays the recording back immediately
- [ ] Name field pre-populated from note OR "Voice Memo {count}"
- [ ] Section picker works
- [ ] Transcribe toggle visible (Pro locked for free users)
- [ ] Discard discards completely
- [ ] Save → uploads → "Processing..." card appears on canvas

**Card on canvas:**
- [ ] VoiceMemoCard appears in Ideas Tree immediately on save
- [ ] "Processing..." chip visible during upload
- [ ] When upload completes: real waveform appears, chip disappears
- [ ] Card pulses gold for 600ms after save (save-pulse animation)
- [ ] Card has correct creator aurora color

**Playback:**
- [ ] Tapping play on VoiceMemoCard streams audio from Supabase
- [ ] Progress bar updates as audio plays
- [ ] Second play uses IndexedDB cache (instant)

**Upload (mobile file picker):**
- [ ] Upload button in Voice layer panel opens file picker
- [ ] iOS Files picker shows Voice Memos folder as a location
- [ ] File types accepted: mp3, m4a, wav, webm, ogg, aac
- [ ] File size validated: 20MB free / 200MB Pro
- [ ] Same card/upload/processing flow as recording

**Upload (desktop drag-and-drop):**
- [ ] Dragging audio file over Voice panel shows dashed drop zone
- [ ] Drop triggers upload
- [ ] Same card flow as recording

**Permission denied:**
- [ ] Recording sheet shows warm denial message (no waveform)
- [ ] "Open Settings →" opens iOS/Android/desktop settings correctly

**Voice layer panel:**
- [ ] Chronological list of memos, newest at top
- [ ] Grouped by section with section headers
- [ ] Mini waveform + name + age + play button per row

---

*Plan finalized: 2026-06-04*
*Depends on: CanvasViewport (Step 1) + VoiceMemoCard (Step 2) + Lovable edge functions*
*Estimated build time: 8 hours*
