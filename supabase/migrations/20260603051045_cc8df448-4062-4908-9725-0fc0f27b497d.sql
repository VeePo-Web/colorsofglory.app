
-- Retry columns on transcripts
ALTER TABLE public.voice_memo_transcripts
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_transcripts_retry_due
  ON public.voice_memo_transcripts (next_attempt_at)
  WHERE status IN ('pending','failed') AND attempt_count < max_attempts;

-- Update storage delta trigger to count finalized/transcribed (not legacy 'ready')
CREATE OR REPLACE FUNCTION public.voice_memo_storage_delta()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_uid uuid;
  old_counts boolean;
  new_counts boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('ready','finalized','transcribed') AND NEW.byte_size > 0 THEN
      SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = NEW.song_id;
      IF owner_uid IS NOT NULL THEN
        PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_counts := OLD.status IN ('ready','finalized','transcribed');
    new_counts := NEW.status IN ('ready','finalized','transcribed');
    SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = NEW.song_id;
    IF owner_uid IS NULL THEN RETURN NEW; END IF;
    IF old_counts AND NOT new_counts THEN
      PERFORM public.apply_storage_delta(owner_uid, -OLD.byte_size);
    ELSIF NOT old_counts AND new_counts THEN
      PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size);
    ELSIF old_counts AND new_counts AND OLD.byte_size <> NEW.byte_size THEN
      PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size - OLD.byte_size);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('ready','finalized','transcribed') AND OLD.byte_size > 0 THEN
      SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = OLD.song_id;
      IF owner_uid IS NOT NULL THEN
        PERFORM public.apply_storage_delta(owner_uid, -OLD.byte_size);
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Backfill: existing 'ready' memos move to 'finalized' or 'transcribed'
UPDATE public.voice_memos m
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.voice_memo_transcripts t
    WHERE t.memo_id = m.id AND t.status = 'ready'
  ) THEN 'transcribed'::public.memo_status
  ELSE 'finalized'::public.memo_status
END
WHERE m.status = 'ready';

-- Helper to flip memo to transcribed
CREATE OR REPLACE FUNCTION public.mark_memo_transcribed(_memo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.voice_memos m
    SET status = 'transcribed'
    WHERE m.id = _memo_id
      AND m.status IN ('finalized','ready')
      AND EXISTS (
        SELECT 1 FROM public.voice_memo_transcripts t
        WHERE t.memo_id = _memo_id AND t.status = 'ready'
      );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_memo_transcribed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_memo_transcribed(uuid) TO service_role;

-- Atomic claim helper for worker (returns the row if claimable, else nothing)
CREATE OR REPLACE FUNCTION public.claim_transcript_attempt(_memo_id uuid)
RETURNS TABLE (memo_id uuid, song_id uuid, attempt_count int, max_attempts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.voice_memo_transcripts t
    SET status = 'processing',
        attempt_count = t.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    WHERE t.memo_id = _memo_id
      AND t.status IN ('pending','failed')
      AND t.attempt_count < t.max_attempts
      AND t.next_attempt_at <= now()
    RETURNING t.memo_id, t.song_id, t.attempt_count, t.max_attempts;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_transcript_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_transcript_attempt(uuid) TO service_role;

-- Reset helper for manual retry (author or owner only — RLS will enforce on client; this is service)
CREATE OR REPLACE FUNCTION public.reset_transcript_attempts(_memo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.voice_memo_transcripts
    SET status = 'pending',
        attempt_count = 0,
        next_attempt_at = now(),
        last_error = NULL,
        error = NULL,
        updated_at = now()
    WHERE memo_id = _memo_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_transcript_attempts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_transcript_attempts(uuid) TO service_role;
