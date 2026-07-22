-- Voice memo stacking — the spine (docs/features/VOICE-MEMO-STACKING-RESEARCH.md §5).
-- Closes the critical persistence hole: layers ("record over this") were
-- linked in memory only and lost on reload. Additive + non-destructive:
-- every existing memo (parent_memo_id null) remains a valid base.

-- 1) The base→layer link + the per-layer mix ------------------------------

ALTER TABLE public.voice_memos
  ADD COLUMN IF NOT EXISTS parent_memo_id uuid NULL
    REFERENCES public.voice_memos(id) ON DELETE SET NULL,
  -- Per-layer quick mix (shared with the room; solo stays a transient
  -- audition client-side). Gain 0–1.5 leaves a little headroom.
  ADD COLUMN IF NOT EXISTS layer_gain real NOT NULL DEFAULT 1.0
    CHECK (layer_gain >= 0 AND layer_gain <= 1.5),
  ADD COLUMN IF NOT EXISTS layer_muted boolean NOT NULL DEFAULT false,
  -- Best-effort record-latency compensation: playback starts this many ms
  -- INTO the layer's audio so it lines up with the base ("loose sketch"
  -- honest — compensated, not sample-locked).
  ADD COLUMN IF NOT EXISTS layer_offset_ms integer NOT NULL DEFAULT 0
    CHECK (layer_offset_ms >= 0 AND layer_offset_ms <= 2000);

CREATE INDEX IF NOT EXISTS voice_memos_parent_idx
  ON public.voice_memos (parent_memo_id, created_at)
  WHERE parent_memo_id IS NOT NULL;

-- 2) One level only — flatten, never error -------------------------------
-- A layer attaches to a BASE. If an insert/update points at a memo that is
-- itself a layer, re-point to that layer's base (the top). Self-parents
-- clear. Data is corrected, never rejected — nothing is ever lost.

CREATE OR REPLACE FUNCTION public.voice_memos_flatten_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  grandparent uuid;
  parent_song uuid;
BEGIN
  IF NEW.parent_memo_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_memo_id = NEW.id THEN
    NEW.parent_memo_id := NULL;
    RETURN NEW;
  END IF;
  SELECT parent_memo_id, song_id INTO grandparent, parent_song
    FROM public.voice_memos WHERE id = NEW.parent_memo_id;
  IF NOT FOUND OR parent_song IS DISTINCT FROM NEW.song_id THEN
    -- Missing or cross-song parent: promote to base rather than fail.
    NEW.parent_memo_id := NULL;
    RETURN NEW;
  END IF;
  IF grandparent IS NOT NULL THEN
    NEW.parent_memo_id := grandparent; -- flatten to the top base
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_memos_flatten_parent ON public.voice_memos;
CREATE TRIGGER voice_memos_flatten_parent
  BEFORE INSERT OR UPDATE OF parent_memo_id ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.voice_memos_flatten_parent();
