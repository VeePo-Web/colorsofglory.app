
CREATE OR REPLACE FUNCTION public.song_search(
  _song_id uuid,
  _q text,
  _limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _needle text := btrim(COALESCE(_q, ''));
  _pat text;
  _lim integer := GREATEST(LEAST(COALESCE(_limit, 20), 100), 1);
  _rows jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(_needle) < 2 THEN
    RETURN jsonb_build_object('song_id', _song_id, 'q', _needle, 'rows', '[]'::jsonb);
  END IF;
  _pat := '%' || replace(replace(_needle, '%', '\%'), '_', '\_') || '%';

  WITH hits AS (
    -- Lyrics, matched per section
    SELECT
      'lyric'::text AS source,
      sl.section_id AS entity_id,
      COALESCE(sec.label, initcap(replace(sec.kind::text, '_', ' '))) AS title,
      sl.plain_text AS haystack,
      sl.updated_at AS at,
      1 AS rank_boost
    FROM public.song_lyrics sl
    JOIN public.song_sections sec ON sec.id = sl.section_id
    WHERE sl.song_id = _song_id AND sl.plain_text ILIKE _pat

    UNION ALL
    SELECT 'note', sn.id, 'Note', sn.body, sn.updated_at, 3
    FROM public.song_notes sn
    WHERE sn.song_id = _song_id AND sn.archived_at IS NULL AND sn.body ILIKE _pat

    UNION ALL
    SELECT 'card', cc.id,
      COALESCE(NULLIF(cc.label, ''), NULLIF(cc.section_label, ''), 'Idea'),
      cc.body, cc.updated_at, 2
    FROM public.canvas_cards cc
    WHERE cc.song_id = _song_id AND cc.archived_at IS NULL
      AND (cc.body ILIKE _pat OR cc.label ILIKE _pat)

    UNION ALL
    SELECT 'take', tk.id, COALESCE(tk.friendly_name, 'Take'), COALESCE(tk.friendly_name, ''), tk.created_at, 4
    FROM public.takes tk
    WHERE tk.song_id = _song_id AND tk.is_archived = false AND tk.friendly_name ILIKE _pat

    UNION ALL
    SELECT 'capture', ic.id, COALESCE(ic.title, 'Captured idea'),
      COALESCE(ic.lyric_snippet, ic.title, ''), ic.updated_at, 2
    FROM public.idea_captures ic
    WHERE ic.song_id = _song_id AND ic.archived_at IS NULL
      AND (COALESCE(ic.lyric_snippet,'') ILIKE _pat OR COALESCE(ic.title,'') ILIKE _pat)
  ),
  snipped AS (
    SELECT h.*,
      GREATEST(position(lower(_needle) in lower(COALESCE(h.haystack, ''))) - 30, 1) AS start_at
    FROM hits h
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'source', s.source,
      'entity_id', s.entity_id,
      'title', s.title,
      'snippet', btrim(substr(COALESCE(s.haystack, ''), s.start_at, 120)),
      'match_at', GREATEST(position(lower(_needle) in lower(COALESCE(s.haystack,''))) - s.start_at, 0),
      'match_len', length(_needle),
      'updated_at', s.at
    ) ORDER BY s.rank_boost, s.at DESC), '[]'::jsonb)
  INTO _rows
  FROM (SELECT * FROM snipped ORDER BY rank_boost, at DESC LIMIT _lim) s;

  RETURN jsonb_build_object('song_id', _song_id, 'q', _needle, 'rows', _rows);
END;
$$;

REVOKE ALL ON FUNCTION public.song_search(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_search(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_search(uuid, text, integer) TO service_role;
