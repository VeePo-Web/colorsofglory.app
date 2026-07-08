# C2 · Capture — Backend Seams (filed to A3 / Lovable)

*Filed by the C2 Capture Agent (Steps 2–7), 2026-07-08. These are contracts to build server-side; the client consumption points already exist or are noted. C2 does NOT build these.*

## 1. `cog/transcript` — singing-tuned STT + word timing + confidence (F12)

**Owner:** Lovable (`transcribe-take` edge fn) · **Client ready:** `ReviewSheet` polls `pollTranscriptUntilReady`; `transcript_json.blocks[]` renders today.

- Swap/augment the transcription model with a **singing-tuned** STT path (sung lyrics, melisma, sustained vowels — speech models mangle these).
- Return **real per-word timestamps** in `transcript_json` (today the on-device tier distributes words evenly across recognition windows; the server tier should be authoritative).
- Add **per-word confidence** (`blocks[].words[].confidence: 0..1`). Client law (locked): low-confidence words are **flagged, never guessed** — the ReviewSheet will underline them for one-tap correction. No canned/fabricated text, ever.

## 2. `cog/analysis` — F13 key / BPM / chord detection

**Owner:** Lovable (new `analyze-take` edge fn or a field on `transcribe-take`) · **Client ready:** `ChordPicker` already accepts `initialKey` / `initialMode` / `initialBpm`; the capture header can render prefills.

- Input: `take_id`. Output: `{ key, mode, bpm, chords: string[], confidence: { key, bpm, chords } }`.
- Client law (locked): prefilled values are **editable, never silently authoritative** — rendered with a "low confidence — tap to confirm" state below the threshold. Detection failure degrades to today's manual entry, silently and calmly.

## 3. `intake-voice-memo` — accept the outbox idempotency key

**Owner:** Lovable · **Client ready as of C2 Step 2:** every capture-scene take now uploads through the Capture Outbox's registered `"intake"` uploader, and every outbox job carries a **stable `idempotencyKey`**.

- Accept an `idempotency_key` form field and dedupe: same key → return the existing `{voice_memo_id, song_id}` instead of creating a second memo.
- Why: the outbox retries after a lost success *response* (upload landed, reply didn't). Today that retry double-creates a memo. In-flight double-submits are already guarded client-side; this closes the crash/offline window.
- After the server accepts it: forward `job.idempotencyKey` in the `"intake"` uploader (`src/lib/voice/captureUploaders.ts`) — a two-line client change, noted there.

## 4. Song-level key/BPM persistence

**Owner:** A3 (`cog/songs` or `cog/sheet`) + Lovable (columns/`chord_charts`) · **Client ready:** `ChordPicker` exposes `onKeyChange(key, mode)` / `onBpmChange(bpm)` — currently unwired in `CaptureSheet` because there is no persistence target.

- Decide home: `songs.key/mode/bpm` columns vs. a `chord_charts` row per song. Then expose an update fn; C2 wires the two callbacks.

## 5. `seed_ideas` server sync (product decision, optional)

**Owner:** product + Lovable · Seeds ("capture now, file later") are **device-local** today (`seedIdeaApi`: localStorage index + IndexedDB blob). Works fully offline; does NOT roam devices and dies with a cleared browser profile.

- If ideas should roam: a `seed_ideas` table + storage path, `seedIdeaApi` becomes sync-through (same durable-first ordering). If not: document the device-local scope in onboarding copy.
