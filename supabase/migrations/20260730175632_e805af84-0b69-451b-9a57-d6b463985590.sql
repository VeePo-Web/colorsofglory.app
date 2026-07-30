ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS trim_start_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end_ms integer;

ALTER TABLE public.takes
  DROP CONSTRAINT IF EXISTS takes_trim_valid;
ALTER TABLE public.takes
  ADD CONSTRAINT takes_trim_valid CHECK (
    trim_start_ms >= 0
    AND (trim_end_ms IS NULL OR trim_end_ms > trim_start_ms)
  );

CREATE OR REPLACE FUNCTION public.set_take_trim(
  _take_id uuid,
  _start_ms integer,
  _end_ms integer DEFAULT NULL
)
RETURNS TABLE (take_id uuid, trim_start_ms integer, trim_end_ms integer, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song uuid;
  v_dur integer;
  v_start integer;
  v_end integer;
BEGIN
  SELECT t.song_id, t.duration_ms INTO v_song, v_dur FROM public.takes t WHERE t.id = _take_id;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'take_not_found';
  END IF;
  IF NOT public.is_song_member(v_song, auth.uid()) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF public.song_role(v_song, auth.uid()) NOT IN ('owner', 'contributor') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  v_start := GREATEST(COALESCE(_start_ms, 0), 0);
  v_end := _end_ms;
  IF v_dur IS NOT NULL THEN
    v_start := LEAST(v_start, GREATEST(v_dur - 250, 0));
    IF v_end IS NOT NULL THEN
      v_end := LEAST(v_end, v_dur);
    END IF;
  END IF;
  IF v_end IS NOT NULL AND v_end <= v_start THEN
    v_end := NULL;
  END IF;

  UPDATE public.takes t
     SET trim_start_ms = v_start,
         trim_end_ms = v_end,
         updated_at = now()
   WHERE t.id = _take_id;

  RETURN QUERY
    SELECT t.id, t.trim_start_ms, t.trim_end_ms, t.duration_ms
      FROM public.takes t WHERE t.id = _take_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_take_trim(_take_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song uuid;
BEGIN
  SELECT t.song_id INTO v_song FROM public.takes t WHERE t.id = _take_id;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'take_not_found';
  END IF;
  IF NOT public.is_song_member(v_song, auth.uid()) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF public.song_role(v_song, auth.uid()) NOT IN ('owner', 'contributor') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  UPDATE public.takes SET trim_start_ms = 0, trim_end_ms = NULL, updated_at = now()
   WHERE id = _take_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_take_trim(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_take_trim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_take_trim(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_take_trim(uuid) TO authenticated;