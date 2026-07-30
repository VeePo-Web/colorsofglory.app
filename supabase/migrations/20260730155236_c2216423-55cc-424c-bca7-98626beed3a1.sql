CREATE OR REPLACE FUNCTION public.song_room_search(
  _song_id uuid,
  _q text,
  _limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _term text := trim(COALESCE(_q, ''));
  _rows jsonb;
  _lim integer := LEAST(GREATEST(COALESCE(_limit, 40), 1), 100);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(_term) < 2 THEN
    RETURN jsonb_build_object('q', _term, 'results', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank DESC, r.updated_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      c.id, c.kind, c.label, c.body, c.section_kind, c.section_label,
      c.tree_kind, c.created_by, c.take_id, c.updated_at,
      (CASE WHEN COALESCE(c.label, '') ILIKE _term || '%' THEN 100 ELSE 0 END
       + CASE WHEN COALESCE(c.label, '') ILIKE '%' || _term || '%' THEN 60 ELSE 0 END
       + CASE WHEN COALESCE(c.body, '') ILIKE _term || '%' THEN 40 ELSE 0 END
       + CASE WHEN COALESCE(c.body, '') ILIKE '%' || _term || '%' THEN 25 ELSE 0 END
       + CASE WHEN COALESCE(c.section_label, '') ILIKE '%' || _term || '%' THEN 15 ELSE 0 END
      )::int AS rank
    FROM public.canvas_cards c
    WHERE c.song_id = _song_id
      AND (
        COALESCE(c.body, '') ILIKE '%' || _term || '%'
        OR COALESCE(c.label, '') ILIKE '%' || _term || '%'
        OR COALESCE(c.section_label, '') ILIKE '%' || _term || '%'
      )
    ORDER BY rank DESC, c.updated_at DESC
    LIMIT _lim
  ) r;

  RETURN jsonb_build_object('q', _term, 'results', _rows);
END;
$$;

REVOKE ALL ON FUNCTION public.song_room_search(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_room_search(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_room_search(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.song_section_summary(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.card_count DESC), '[]'::jsonb) INTO _rows
  FROM (
    SELECT
      COALESCE(NULLIF(trim(c.section_label), ''), c.section_kind::text, 'Unfiled') AS section,
      c.tree_kind,
      count(*)::int AS card_count,
      max(c.updated_at) AS last_activity_at
    FROM public.canvas_cards c
    WHERE c.song_id = _song_id
    GROUP BY 1, 2
  ) s;

  RETURN jsonb_build_object('sections', _rows);
END;
$$;

REVOKE ALL ON FUNCTION public.song_section_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_section_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_section_summary(uuid) TO service_role;