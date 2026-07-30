# R12 — Nothing Is Pending Forever (Songwriting Room + Feed Audit, round 12)

Owner: Claude (frontend). Backend shipped by Lovable this round.
Goal of the room, unchanged: **everything for this song stays connected here.**
R12 is about derived work — transcripts and waveforms — and the honesty of
waiting.

## The one sentence

A take whose transcript failed looks identical to one that is still thinking:
both show a shimmer that never resolves, so the room quietly lies about its own
state and the person has no way back.

---

## Findings

### P0-1 — Indefinite shimmer
A skeleton with no terminal state is the single most corrosive pattern in the
room — it trains people not to trust the app.
**Fix:** drive take states from `getSongPendingWork(songId)`. Three states only:
*Transcribing…* (pending/processing), *Couldn't transcribe* (failed, with retry),
and done (no entry at all). Never render a shimmer for an item absent from the
pending list.

### P0-2 — No way back from failure
`can_retry` exists and nothing surfaces it.
**Fix:** a failed take shows one inline text action — "Try again" — calling
`retryTakeTranscript(takeId)`. Optimistically move the row to *Transcribing…*.
Gate on `caps.can.write_lyrics` from R10; viewers see the failed state without
the action.

### P0-3 — Failure must never threaten the audio
The critical message is that the recording itself is safe.
**Fix:** the failed state reads "Couldn't transcribe — the recording is safe."
The take stays fully playable, nameable, and attachable in every failed state.
Transcription is an enhancement; never let its failure gray out the audio row.

### P1-4 — Waveform vs transcript conflated
`waveform_pending` is separate from transcript status.
**Fix:** a missing waveform renders as a calm flat gold baseline — not a
skeleton, not an error. Playback works without it. No copy at all for this case.

### P1-5 — Polling discipline
**Fix:** fetch pending work on mount, on realtime `takes` events, and on tab
refocus. Only when the list is non-empty, add a slow poll (10s) — and stop the
poll the instant the list empties or the tab hides. No interval left running in
a room with nothing pending.

### P1-6 — Retry honesty
`attempt_count` / `max_attempts` / `next_attempt_at` are returned.
**Fix:** do not display counters — they are engineering detail. Use them only to
suppress the "Try again" action while an automatic retry is already imminent
(`next_attempt_at` within 60s), so a tap can't feel ignored.

### P1-7 — The feed must not narrate machinery
Transcription lifecycle events should not appear in the feed at all — the person
did not do them.
**Fix:** ensure no feed row is generated or rendered for transcript state
changes. The feed is for human intention (R11).

### P2-8 — Simplicity guard
No progress percentages, no queue position, no "processing 2 of 5" banner, no
settings for transcription. Status lives on the take it belongs to and nowhere
else.

---

## Backend contract (live)

```ts
import { getSongPendingWork, retryTakeTranscript } from "@/integrations/cog/takes";

const { items } = await getSongPendingWork(songId);
// item: { take_id, friendly_name, status, error, can_retry,
//         waveform_pending, attempt_count, max_attempts, next_attempt_at }

await retryTakeTranscript(takeId); // requires edit rights
```

Both are membership-gated; `retry_take_transcript` additionally requires song
write rights, clears the error, resets the attempt counter and queues the job for
immediate pickup. Audio rows are never modified.

## Definition of done

1. No shimmer in the room can outlive its job.
2. Every failed transcript offers exactly one retry, and says the recording is safe.
3. A take with no waveform still plays, with a calm baseline and no copy.
4. Polling exists only while something is genuinely pending.
5. Machine lifecycle never reaches the feed.
6. No counters, percentages, or queue positions anywhere.
