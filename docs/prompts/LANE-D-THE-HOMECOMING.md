# LANE D — THE HOMECOMING: the voice memo you already made comes home to the song

> **The creed.** The memo you already made is a captured idea too — and right now it
> is the one most likely to be lost, because it lives between two apps. The
> Homecoming is one door, the file safe on the first tap, and everything else — a
> name, a transcript, a place in the song — arriving afterward as a gift, never as
> a form. The bar: an 8-year-old gets their hum from Voice Memos into their song
> without reading a paragraph. Steve Jobs would count the taps; we count them too:
> **≤3 in-app taps from door to playable card.**

**Status:** VISION + PLAN (this doc). Implementation fires in phases below, each
pass re-firable, each pass committed under the Concurrent-Tree Git Protocol.
**This lane must not collide with the two live lanes** (songs-organization /
library UI, and canvas) — see Part 8 fences.

Research base (2026-08, three parallel streams): full codebase surface map ·
iOS/Android platform truth (sourced) · benchmark teardowns (GarageBand, BandLab,
Otter, Splice/Tape It, WhatsApp, Apple system patterns). Key citations inline.

---

## PART 1 — WHY THIS FEATURE DECIDES THE PRODUCT

Every songwriter we serve already has a graveyard: dozens ("hundreds of unlabeled
recordings" — Spit Notes; a pro writer auto-named into the 1300s — Shindell) of
hums in the iPhone Voice Memos app. Feature 11's north star says it exactly:
**"Do not just store audio. Turn trapped phone recordings into connected song
material."** The competition's failure is documented:

- **GarageBand** (the cautionary benchmark): the real funnel is a two-app relay of
  ~10–11 interactions ending in a precision drag and a silent 8-bar truncation
  trap. Every step documented, none broken — and the composite defeats adults.
- **Otter** (the gold standard): Import → picker → done. **3 taps, zero fields**,
  title from filename, "you can safely close the app — processing continues on
  our servers," notify on done, honest time expectation.
- **WhatsApp** (the reliability standard): zero fields ever, instant bubble,
  aggressive client retry + server dedupe — the user never sees a retry decision.
- **iMessage** (the canonical sin): audio expires by default. A destructive
  default in an audio product is the fastest trust-killer that exists.

**The Homecoming = Otter's tap count × WhatsApp's bubble-instantly ×
Voice-Memos-native format truth × COG's guided-rail warmth.**

### The Laws of the Effortless Import (distilled from the benchmarks — these govern every screen)

1. **The file is safe before anything is asked.** No name, no section, no
   category before persistence. Title comes from the filename as a *suggestion*.
2. **One tap = one visible object, instantly.** Each picked file materializes as
   a playable card with a waveform before the upload finishes.
3. **Pick from the familiar, recents-first place.** The native Files picker IS
   the UI (the PHPicker principle). We never build a file browser.
4. **The upload survives you leaving.** Blob durable in IndexedDB first;
   server-ACK before "Saved"; retry survives backgrounding; honest "keep this
   open a moment" when it matters.
5. **Convert silently; never lecture about formats.** `.m4a` is THE format —
   it is what Voice Memos exports. It must simply work.
6. **Honest time expectations for processing.** "Words usually take about as
   long as the memo." Vague spinners read as broken.
7. **In a batch, every file has its own truth.** Per-card state; a failed file
   retries alone; never a single global spinner (Feature 11 forbids it too).
8. **Errors name the cause and the fix in one sentence.** The Mail Drop move:
   detect the problem, offer the fix, one tap.
9. **Enrichment arrives after safety, as a gift.** Transcript = draft lyric
   lines attached to the take — suggested, never auto-inserted.
10. **Never destroy by default; retain and retry invisibly.**

---

## PART 2 — PLATFORM TRUTH (the physics this funnel is built on)

Verified 2026-08 with sources; anything unverifiable is marked. These are LAWS
for implementation — deviate from none of them.

**T1 · `accept="audio/*"` is BROKEN on iOS Safari.** Open WebKit bug (#242110,
reproduced through iOS 18-era, assume live): audio is internally treated as
video; the picker shows Photo/Camera/Browse and audio files are **grayed out**
in Browse. → Never ship bare `audio/*`. The working string (Gradio's shipped
fix — explicit entries un-gray files; `audio/*` last keeps Android filtering):

```
accept=".m4a,.mp3,.wav,.aac,.ogg,.flac,.webm,audio/mp4,audio/x-m4a,audio/mpeg,audio/wav,audio/*"
```

**T2 · There is NO share-into-web on iOS. Ever.** No share-sheet target, no Web
Share Target API in Safari/PWA (still unshipped as of 2026). The ONLY universal
path: **Voice Memos → Share → Save to Files → our picker's Browse → Recents.**
→ The world-class version of this feature is a beautifully coached two-step,
not a hunt for a magic API. (Android Chrome DOES ship Web Share Target for
installed PWAs incl. audio files — a real "share straight to COG" exists there;
filed as a later gift, needs manifest work.)

**T3 · What Voice Memos exports.** Default: rendered `.m4a` (AAC ~64kbps mono
Compressed ≈ **0.5 MB/min**; optional Lossless = ALAC ~30× bigger, same .m4a
shell). Since iOS 18.2, layered memos can export **`.qta`** (QuickTime Audio) —
**browsers cannot play it**; detect the extension and redirect kindly.
Filenames: "New Recording 3", location names, the user's custom title — treat
as a *suggested title*, never parse for logic; expect emoji/non-ASCII.

**T4 · The MIME lie.** iOS reports `.m4a` as nonstandard **`audio/x-m4a`**
(sometimes `audio/m4a`, sometimes empty). → Validate **extension first, MIME
second**; treat x-m4a/m4a/empty as valid; **normalize before upload — send
`audio/mp4` as Content-Type for m4a** (never trust `File.type`, never fall
back to a recorder mime).

**T5 · Multi-select exists but is hidden** on iOS (Files picker: ⋯ → Select).
→ `multiple` everywhere, but the happy path is designed single-file; multi is
a power path, never required by the instructions.

**T6 · iCloud flake.** A picked file not yet downloaded from iCloud can arrive
broken/empty. → Check `file.size > 0` post-pick; calm one-line retry copy.

**T7 · Decode discipline.** `decodeAudioData` inflates to PCM (~10MB/min/chan);
15-min files crash iOS. → Duration from `<audio>` `loadedmetadata` (reliable
for real .m4a — the Infinity bug is a MediaRecorder-blob disease, not an
import one), ALWAYS timeout-raced. Waveform: one decode → downsample to peaks
→ release the buffer; **skip client decode entirely** past the existing 20MB /
~10-min gate (seed waveform fallback; peaks can arrive later server-side).
Safari's promise-form decode sometimes rejects where callback-form succeeds —
wrap in a fallback chain; decode failure is never fatal.

**T8 · Backgrounding kills uploads; there is no Background Sync on iOS.** iOS
18-era bugs: >1MB cellular uploads timing out; fetch-on-return "Load failed".
→ Single PUT + retry/backoff is correct at Voice-Memos sizes (3-min memo ≈
1.5MB); ACK-before-Saved; on `visibilitychange` mid-upload show "Still saving —
keep this open a moment"; delay auto-resume ~1s after visibility returns.
Chunked/tus is justified only if we later accept Lossless/hour-long files.

**T9 · The server truth is 50MB** and an exact-match mime allowlist
(`audio/webm, audio/mp4, audio/mpeg, audio/wav, audio/x-wav, audio/ogg`).
One honest size limit everywhere; oversize gets the Mail-Drop move ("This
one's over 50MB — likely a Lossless recording. In Voice Memos settings choose
Compressed, or trim it, then share again.").

---

## PART 3 — THE FUNNEL (five moments, start to finish)

The grammar is the app's existing guided-rail contract: one card at a time ·
skippable · the thing already safe · ends in "where does it live."

### Moment 1 — THE DOOR (one door, everywhere audio can begin)
One shared entry — **"Add a voice memo you already have"** — rendered by ONE
component wherever recording is offered: the capture scene (today's
`ImportMemoButton`), the song Voice tab, the canvas voice sheet, and the
library's song actions (Lane C's surface — coordinate, don't duplicate). The
door goes STRAIGHT to the native picker (T1 accept string, `multiple`). No
intermediate sheet when the user already knows the way.

### Moment 2 — THE COACH (first time only, pictures not paragraphs)
A once-per-device illustrated two-step card, shown alongside (never instead
of) the picker button:

> **1.** In **Voice Memos**: `⋯ Share → Save to Files → Save`
> **2.** Back here: `Browse → Recents` — your memo is at the top

"I have the file" goes straight to the picker; the coach never blocks; a quiet
`?` re-opens it forever. This is the honest substitute for share-sheet
presence (T2) — it converts the AirDrop/text-yourself workaround culture into
a two-tap ritual instead of pretending the relay doesn't exist. Android with
share-target lands later and simply never shows the coach.

### Moment 3 — THE CARD, INSTANTLY (the WhatsApp bubble)
The instant files are chosen, **each becomes the same voice-memo card the app
already uses** — playable from the local blob, waveform present, title
suggested from the filename (extension stripped), duration from guarded
`loadedmetadata`. Blob is durable in IndexedDB **before** any network. Zero
fields asked. A batch renders as a calm stack under one summary line
("Saving 3…" → "3 saved") — per-card truth, no dashboard.

### Moment 4 — THE QUIET UPLOAD (the rail that already exists)
Imports ride the SAME outbox rail as recorded takes (`saveMemoDurable` →
captureOutbox → uploader → the one upload core): normalize mime (T4) → single
PUT → finalize with real duration + peaks → server-ACK → "Saved". Per-card
chip: `Saving… → Saved` / `Retry` (a failed file retries alone). Storage-full
retains the job without burning attempts and opens the add-storage door
("Your songs are safe — new imports need more room."). Backgrounded mid-PUT:
"Still saving — keep this open a moment," auto-resume on return (T8).

### Moment 5 — THE GIFT (transcript, then "where does it live")
Finalize already auto-starts transcription server-side. The card says the
honest thing: **"Words are coming — usually takes about as long as the memo."**
The transcript arrives as draft lyric lines ON the card (the F12 path already
renders it) — suggested, never auto-inserted into the sheet. Then the one
guided question, same grammar as capture: imports made *inside* a song file to
that song immediately (section optional, one chip tap, skippable); imports
made from the global capture surface land on the Ideas shelf and offer the
existing filing rail. TEMU momentum: the arrival state offers exactly one next
act — **"Hear it in the room."**

### The 8-year-old script (the acceptance test that matters)
"Your hum from last week is in Voice Memos. Put it in your song."
- They see one gold door with a picture-coach the first time. Two coached taps
  in Voice Memos, then **Browse → Recents → tap the file** — and it's a card
  they can PLAY, immediately, before any spinner finishes.
- Nothing asks them to type. Nothing asks them to choose before it's safe.
- If anything fails, the card stays, says why in one kind sentence, and offers
  one tap to retry. Nothing they did is ever gone.

---

## PART 4 — WHAT EXISTS TODAY (surface map) AND WHAT'S BROKEN

Four separate, non-unified implementations already ship (full map in research):

| Surface | Component | Multi? | Cap shown | Pipeline |
|---|---|---|---|---|
| Capture scene (mobile primary) | `ImportMemoButton.tsx` | **no** | 50MB | enqueue "intake" → review |
| Song Voice tab | `UploadDropZone` @ `VoiceMemosPage.tsx:816` | yes | 20/200MB | `saveMemoDurable` |
| Canvas voice sheet | `UploadDropZone` @ `VoiceLayerPanel.tsx:191` | yes | 20MB (isPro unthreaded) | `saveMemoDurable` |
| Library song actions | hidden input @ `SongCatalogPage.tsx:1164` | yes | "200MB" | `saveMemoDurable` |

**The P0 bug ledger** (all confirmed by code read; fix in Phase D1):

- **B1 · The flagship path is broken at the picker.** `ImportMemoButton.tsx:57`
  ships bare `accept="audio/*"` — on iOS the WebKit bug (T1) grays out every
  audio file in Browse. The primary mobile import entry cannot pick a Voice
  Memo on an iPhone.
- **B2 · The flagship file 400s after picking elsewhere.** iOS reports `.m4a`
  as `audio/x-m4a` (T4). The client allowlist (`audioFormat.ts:56-68`) accepts
  it; the server (`voice-memo-upload-url` ALLOWED_MIME) does NOT → 400
  "Unsupported mime_type" after the user already picked the file. Fix
  client-side by normalizing m4a→`audio/mp4` (already server-allowed) before
  `createUploadUrl`; separately FILE the allowlist widening with Lovable.
- **B3 · Empty `file.type` becomes an illegal recorder mime.**
  `VoiceMemosPage.tsx:678` and `VoiceLayerPanel.tsx:95` fall back to
  `getBestMimeType()` (`audio/webm;codecs=opus`) — exact-match server → 400.
  Fallback must sniff by extension, never borrow the recorder's mime.
- **B4 · Storage-full burns and parks instead of retaining.** Server 413 body
  `"Storage limit exceeded"` is not matched by `isStorageQuotaError`
  (`captureOutbox.ts:132-143`) → 6 burned attempts → parked, and the designed
  "Your songs are safe + Add storage" moment never fires.
- **B5 · Three size caps lie against the 50MB server truth.** 20/200MB
  (`UploadDropZone:50`), 200MB (`SongCatalogPage:178` — its "server cap"
  comment is wrong), 50MB (`ImportMemoButton:5`); server = 50MB. A 120MB pick
  passes the client and dies as an opaque retrying job. Also: `isPro` never
  threaded at `SongCanvasExperience.tsx:3110`.

**Capability gaps** (the vision's build list): no per-file progress anywhere
(single global spinners — exactly what Feature 11 L331 forbids) · no duplicate
detection (spec: filename/size/duration compare) · intake-path imports get **no
duration and no peaks** (CaptureScene bypasses `saveMemoDurable`;
`intake-voice-memo` never writes `duration_ms`) · non-intake imports get **no
takes row**, so ReviewSheet/transcript-polling/GuidedShapeRail are unreachable
from the multi-file paths · unguarded `getAudioFileDuration` (no timeout) on
both drop-zone surfaces (iOS can suspend metadata loads forever — the catalog
path already wraps a 4s race; the helper itself should own the guard) · no
`.qta`/zero-byte kindness · original filename lossy (`failedCaptureStore`
rebuilds `recovered-*.webm`) · `sourceType:"import"` union exists at
`canvasTypes.ts:44` but is never written · no import analytics (spec names 11
events) · capture import is single-file.

---

## PART 5 — THE BUILD PLAN (phased, re-firable, each pass ships)

**Phase D1 — TRUTH (make today's doors honest; the P0 pass).**
One shared import core `src/lib/voice/audioImport.ts`:
`prepareImport(file) → { ok, blob, mimeType, title, durationMs?, peaks?, reason? }`
— validates extension-first (T4), normalizes mime (m4a/x-m4a/empty →
`audio/mp4`/sniffed), guards duration (timeout-raced inside the helper), runs
the existing peaks/decode discipline (T7 gates), returns kind reason codes
(`qta`, `too-big`, `empty-file`, `not-audio`). Every surface calls it; the
`ACCEPT_AUDIO` string (T1) and `IMPORT_MAX_BYTES = 50MB` live here as the one
truth. Fix B1–B5 at their named lines (incl. `isStorageQuotaError` matching
the real 413 body, and threading `isPro` — or simply retiring the fictional
200MB tier to the 50MB truth). Add `multiple` to `ImportMemoButton`.
*Tests:* accept-string snapshot; mime normalization table (x-m4a/m4a/empty/
mp3/wav/qta); size gate; storage-413 classified as quota (job stays queued,
zero attempts burned).

**Phase D2 — THE DOOR + THE COACH.** One `ImportDoor` component (label, picker
wiring, coach trigger) replacing the four ad-hoc entries; the once-per-device
illustrated coach (`cog:import-coach-seen`, same pattern as RoomWelcome);
`.qta` / zero-byte / oversize kindness rendered inline at the door. iPad/
desktop drop zone kept (UploadDropZone becomes a consumer of the core).

**Phase D3 — THE CARDS.** Per-file optimistic cards through the outbox rail
with per-card `Saving…/Saved/Retry` chips + the batch summary line; keep-open
visibility messaging (T8); failed files retry alone; duplicate detection
(filename+size+duration vs the song's memos → "This may already be in the
song · Import anyway / Skip" — Feature 11's screen, verbatim).

**Phase D4 — THE GIFT.** Transcript expectation copy on import cards; takes-
row parity so imports reach ReviewSheet + the filing rail (client half; server
half FILED); global-capture imports → Ideas shelf + filing rail; the one
next-act chip ("Hear it in the room"); `sourceType:"import"` written at
creation (provenance for credits later); the 11 `audio_import_*` analytics
events (bucketed; never filenames).

**FILED-BACKEND (Lovable lane — file, never touch):**
1. Widen `voice-memo-upload-url` ALLOWED_MIME (+`audio/x-m4a`, `audio/m4a`,
   `audio/aac`, `audio/x-aac`, `audio/wave`) — defense-in-depth behind the
   client normalization.
2. `intake-voice-memo`: write `duration_ms` + accept `waveform_peaks`; and a
   takes row on the upload-url path (or trigger) so every import is
   review-reachable.
3. Reconsider the 50MB cap vs Lossless memos (ALAC ≈ 10MB/min) — or a server
   transcode step; until then the Mail-Drop copy stands.
4. Android PWA `share_target` (manifest + receiving route) — the one-tap
   share-in Android deserves.
5. `voice_memos.song_id` NULL inbox migration (already filed; unblocks a true
   Unfiled Inbox beyond the local Ideas shelf).

---

## PART 6 — COPY SYSTEM (verbatim; calm, never technical)

- Door: **"Add a voice memo you already have"** · sub: "MP3, M4A, WAV · from
  Files · pick several at once"
- Coach title: **"Two taps in Voice Memos, and it's home"** · steps as Part 3 ·
  dismiss: "I have the file"
- Saving: "Saving…" → "Saved" · batch: "Saving 3…" → "3 saved" · partial:
  "2 saved. 1 needs a retry."
- Keep-open: "Still saving — keep this open a moment."
- Retry chip: "Retry" · failure row: "That one didn't come through — it's
  still safe here."
- `.qta`: "That's an Apple layered recording — in Voice Memos, share it again
  and choose the standard option."
- Zero-byte/iCloud: "That file didn't finish downloading from iCloud — open it
  once in Files, then try again."
- Oversize: "That one's over 50MB — likely a Lossless recording. Trim it, or
  set Voice Memos quality to Compressed, then share again."
- Storage-full: "Your songs are safe — new imports need more room." + door
- Transcript: "Words are coming — usually takes about as long as the memo."
- Never: "unsupported mime type", "upload failed", "error", codes, red walls.

---

## PART 7 — ACCEPTANCE (evidence before "done", per phase)

- `tsc --noEmit` + `vite build` green; suites green (flake rule: re-run
  isolated before believing a cold-run red).
- **The tap count:** door → playable card ≤3 in-app taps, measured on the real
  funnel (picker taps excluded — they're Apple's).
- **The stress script:** pick real `.m4a` (x-m4a mime) → card + Saved · empty
  `file.type` → Saved · `.qta` → kind redirect · 60MB → kind size line ·
  airplane-mode mid-upload → card retained, retries on return, ends Saved ·
  storage-full → zero burned attempts, add-storage door · 5-file batch with
  one failure → 4 saved, 1 retries alone · kill the tab mid-upload → reopen →
  the card is there, still trying.
- What can't be verified in this environment is named honestly per pass
  (real-iPhone picker behavior, iCloud flake) with an exact on-device script.

## PART 8 — LANE FENCES (two agents are live in this tree)

- Live lane: library/organization (Lane C) — holds `src/pages/SongCatalogPage`,
  `src/components/library/**`, `libraryCalm`, `NewSheet`, and is a consumer of
  `UploadDropZone`. Live lane: canvas — holds `SongCanvasExperience.tsx`, and
  voice-lib files were observed in flight (`pendingUploads`, `captureOutbox`,
  `seedIdeaApi`, `VoiceMemosPage`).
- **Lane D implementation starts only against a clean rebase of their landed
  work** — never against their working tree. New Lane D files
  (`audioImport.ts`, `ImportDoor`, coach) are collision-free by construction;
  edits to shared surfaces (`ImportMemoButton`, `UploadDropZone`,
  `captureOutbox`, page handlers) happen ONLY when those files are quiet, via
  worktree, staged by path, index-checked, fetch-gated. If a fix belongs to a
  file another lane holds mid-flight, FILE it in the pass report instead.
- Never touch `.agents/`, `tmp/`, other lanes' docs. Commit messages end:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
