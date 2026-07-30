# R57 — "The hum survives no signal"

**Audit round 57 · Songwriting Room · Voice capture durability**
Owner: Claude (frontend). Backend + SDK shipped by Lovable.

---

## 1. The stress test

Rehearsal in a church basement. One bar of signal, then none.
Someone hums a bridge into the room, hits stop, the card animates in — and
then the phone locks. Twenty minutes later they open the app.

**Today: the hum is gone.** The blob lived in page memory. The upload failed,
the component unmounted, nothing was written anywhere. No error, no trace, no
recording. The single most precious, least reproducible artifact in this
product is the only one with no durability story. `outbox.ts` protects typed
cards. Audio had nothing.

Second failure mode, subtler: the upload *did* succeed but the response never
came back. Retry produced a **second identical take**, and the takes drawer
now shows two of the same hum with no way to know which is which.

---

## 2. The reference standard

- **Voice Memos (iOS)** — the recording is on disk before the UI redraws.
  Sync is a later, invisible concern. You cannot lose a recording by losing
  a network.
- **WhatsApp voice notes** — the note appears in the thread immediately with
  a small clock; it sends itself when signal returns. You are never asked to
  re-record, and you never tap "retry" unless you want to.
- **Instagram / Superhuman drafts** — the queue is *not* a screen. It is one
  quiet mark on the item itself.

The lesson for us: **a recording is saved the instant you stop, not when the
network agrees.** Uploading is a property of a card, not a modal.

---

## 3. What shipped (backend + SDK — do not rebuild)

`src/integrations/cog/audioOutbox.ts`

| Export | What it does |
|---|---|
| `queueRecording({ song_id, blob, section_id?, title?, duration_ms?, waveform_peaks?, make_primary? })` | Writes the blob to **IndexedDB first**, then attempts upload. Resolves with a `client_key` as soon as the blob is safe — never blocks on the network. |
| `subscribeAudioOutbox(fn)` | `{ pending, failing, online, uploading }`. |
| `subscribeAudioOutboxResults(fn)` | Fires once per recording the moment the server confirms it: `{ client_key, take_id, voice_memo_id, storage_path }`. |
| `listQueuedRecordings(song_id?)` | Queued entries + a local `object_url` so a not-yet-uploaded hum is **fully playable offline**. |
| `retryAudioOutboxNow()` | Force retry (a "try again" tap). |
| `reconcileAudioOutbox(song_id)` | On room open: asks the server which queued keys already landed, drops those blobs. Kills the duplicate-take class of bug. |
| `startAudioOutbox()` | Background drain on interval + `online` + tab focus, exponential backoff. Call once at app mount. |

Server: `create_take_idempotent(...)` is unique on `(song_id, client_key)` —
a retry after an ambiguous failure returns the **same** take. Role and lock
checks are enforced inside it.

---

## 4. What you build

### 4.1 Recording stop → instant card (the whole point)

Replace the current record→upload→await→render chain with:

```
onStop(blob):
  key = await queueRecording({ song_id, blob, section_id, duration_ms, waveform_peaks })
  insert an optimistic take card into the section, keyed by `key`
  → the card is playable immediately from the local blob
```

The card enters with the standard 400ms `translateY(8px)→0` / opacity reveal.
**No spinner. No "uploading…" screen. No blocking sheet.** The waveform is
drawn from the local peaks you already computed while recording.

### 4.2 The only sync affordance: one dot on the card

While a card is queued, show a **6px gold dot** in the card's top-right
corner, at 60% opacity, gently breathing (1.8s ease-in-out, opacity 0.4↔0.8).

- Confirmed (`subscribeAudioOutboxResults` fires for that `client_key`) →
  the dot **fades out over 250ms**. Nothing else changes. No toast, no
  "Saved!", no layout shift. Swap the optimistic key for the real `take_id`
  in place.
- Offline (`status.online === false`) → the dot stops breathing and holds at
  40%. Long-press / tap the card reveals one line of caption:
  *"Waiting for signal."* That is the entire offline UI.
- Failing (`attempts ≥ 3`, surfaced as `failing`) → the caption becomes
  *"Still trying — tap to retry."* Tap calls `retryAudioOutboxNow()`.

**Do not build:** an outbox screen, a sync settings page, a progress bar, a
percentage, a queue list, a banner, a red badge, or a modal. The dot is the
feature. (Design law: calm, non-overwhelming — no red badge counts.)

### 4.3 Room open

In the room bootstrap effect, after mount:
```
reconcileAudioOutbox(songId)   // drop anything the server already has
```
Then merge `listQueuedRecordings(songId)` into the takes list so a hum
recorded offline **yesterday** is sitting in its section today, playable, dot
breathing. Sort it by `created_at` alongside server takes — a queued
recording is not second-class and never gets its own separate shelf.

### 4.4 App mount

Call `startAudioOutbox()` once in the app shell (same place as
`startOutbox()`), and dispose on unmount.

### 4.5 Leaving mid-record

If the user navigates away or backgrounds the app while recording, stop the
recorder and `queueRecording` whatever exists. A three-second fragment saved
beats a perfect take lost. Never show a "discard?" confirm on navigation —
just keep it. (Design law: nothing you remove is gone; here, nothing you
*record* is ever lost either.)

---

## 5. Removals (trim the fat)

1. Any `await uploadTake(...)` in the recorder path — recording no longer
   awaits the network.
2. The upload spinner / "Saving memo…" state in the record sheet.
3. Any "Upload failed — try again?" alert or toast.
4. Any code that discards a blob on component unmount.
5. Any duplicate-take dedupe logic in the takes drawer — the server key
   handles it now.

---

## 6. Acceptance — walk it

1. Airplane mode. Record a hum. Stop. → Card appears instantly, plays back,
   gold dot breathing.
2. Force-quit the app. Reopen, still offline. → The card is still there,
   still plays, dot still there.
3. Turn signal on. Don't touch anything. → Within 8 seconds the dot fades.
   Nothing else moves on screen.
4. Kill the network mid-upload, restore it. → Exactly one take, never two.
5. Second phone in the same song. → The take appears there the moment it
   lands, via the existing live channel.
6. View-only member tries to record. → The record control isn't there at all;
   the RPC would reject them anyway.

---

## 7. How this serves the one goal

The room's promise is *everything for this song stays connected here*. A lost
hum is the promise broken in the worst possible place — the one artifact that
cannot be retyped. After R57, the room keeps that promise on one bar of
signal, on no bars, and through a dead battery, and it does it with a single
6px dot instead of a single new screen.
