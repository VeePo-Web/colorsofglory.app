# Voice Memo Lifecycle + Transcription Auto-Retry

Extends Migration #4 with an explicit lifecycle on `voice_memos`, retry bookkeeping on `voice_memo_transcripts`, and a scheduled worker that re-drives failed/pending transcriptions.

## Schema changes (Migration #5)

### 1. Expand `memo_status` enum
Add new values so the memo row tracks the full lifecycle:

- `uploading` (existing) — row created, awaiting bucket PUT
- `uploaded` (new) — bucket object present, not yet finalized
- `finalized` (new) — size verified, transcript queued; replaces today's `ready`
- `transcribed` (new) — transcript reached `ready`
- `failed` (existing) — unrecoverable upload/finalize error
- `deleted` (existing)

Postgres enums can only be appended, so we add the three new values and migrate existing `ready` rows to `finalized` (and to `transcribed` if their transcript is already ready). `ready` stays in the enum (Postgres can't drop values) but is no longer written by new code.

The storage-delta trigger updates to count any row in (`finalized`, `transcribed`) — the byte size doesn't change between finalize and transcribe, so usage stays correct.

### 2. Add retry fields on `voice_memo_transcripts`

- `attempt_count int default 0`
- `max_attempts int default 5`
- `next_attempt_at timestamptz default now()` — when the worker is allowed to retry
- `last_attempt_at timestamptz`
- `last_error text` — kept alongside existing `error` for clarity
- Partial index on `(next_attempt_at)` where `status in ('pending','failed')` and `attempt_count < max_attempts` so the worker query is cheap.

### 3. New helper: `mark_memo_transcribed(memo_id uuid)`
SECURITY DEFINER. Called by the transcribe function on success to flip `voice_memos.status` to `transcribed`. Validates the transcript row is `ready`.

## Edge function changes

### `voice-memo-finalize`
- On success, set `voice_memos.status = 'finalized'` (was `ready`).
- Insert/upsert transcript row with `status='pending'`, `attempt_count=0`, `next_attempt_at=now()`.
- Still fires `voice-memo-transcribe` immediately for low latency; the cron worker only catches stragglers.

### `voice-memo-transcribe`
Rework to be idempotent and retry-aware:
1. Atomically claim the row: `UPDATE voice_memo_transcripts SET status='processing', attempt_count=attempt_count+1, last_attempt_at=now() WHERE memo_id=$1 AND status IN ('pending','failed') AND attempt_count < max_attempts RETURNING *`. If no row claimed, exit 200 (already done / exhausted / in flight).
2. Run Gemini Flash transcription as today.
3. On success: write transcript `status='ready'`, clear errors, then call `mark_memo_transcribed`.
4. On failure: compute backoff (`min(60s * 2^attempt_count, 30 min)` + jitter), set `status='failed'`, `last_error`, `next_attempt_at = now() + backoff`. If `attempt_count >= max_attempts` it stays `failed` and the worker stops picking it up.

### New `voice-memo-transcribe-worker` (scheduled)
- Service-role only.
- Query: `SELECT memo_id FROM voice_memo_transcripts WHERE status IN ('pending','failed') AND attempt_count < max_attempts AND next_attempt_at <= now() ORDER BY next_attempt_at LIMIT 10`.
- For each, invoke `voice-memo-transcribe` (fire-and-forget, capped concurrency of 3 via Promise pool).
- Returns counts for observability.

### Scheduling
Enable `pg_cron` + `pg_net` and schedule the worker every minute via `cron.schedule`. Uses `supabase--insert` (not migration) per project-specific URL/anon-key rule. One-minute cadence keeps the typical retry latency well under a minute while letting backoff stretch out.

## SDK changes (`src/integrations/cog/memos.ts`)

- Update `VoiceMemo` type usage — no API shape change, but consumers should treat `status` as the lifecycle field. Add a typed enum re-export:
  ```ts
  export type MemoLifecycle = "uploading" | "uploaded" | "finalized" | "transcribed" | "failed" | "deleted";
  ```
- Add `retryTranscription(memoId)` thin wrapper that resets `attempt_count=0`, `status='pending'`, `next_attempt_at=now()` via a new `voice-memo-retranscribe` edge function (service-checked to require author or song owner). This unblocks rows that exhausted their attempts when the user explicitly asks for another try.
- `listMemosForSong` / `listMemosForSection` already return the row including `status`; no change needed beyond docs.

## What is NOT in this plan

- Switching the worker to Inngest — keep pg_cron to avoid a new connector dependency. Inngest stays an option for later phases.
- Streaming/partial transcript updates.
- Memo-side activity feed entries (Migration #6 territory).

## Sequence

1. Migration: enum values, transcript retry columns, partial index, `mark_memo_transcribed` helper, backfill `ready` → `finalized`/`transcribed`.
2. Update `voice-memo-finalize` and `voice-memo-transcribe`.
3. Add `voice-memo-transcribe-worker` and `voice-memo-retranscribe` edge functions.
4. `supabase--insert` to enable `pg_cron`/`pg_net` and schedule the worker every minute.
5. Update SDK (`memos.ts`) with the lifecycle type and `retryTranscription` helper.
6. Run linter; expected SECURITY DEFINER warnings only (same accepted pattern).

After your approval I'll run through these in order without pausing unless something surprises me.
