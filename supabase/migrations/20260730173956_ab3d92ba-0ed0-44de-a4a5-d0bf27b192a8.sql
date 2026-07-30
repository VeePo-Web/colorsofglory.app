CREATE OR REPLACE FUNCTION public.song_gaps(_song_id uuid)
RETURNS TABLE (
  section_id uuid,
  label text,
  kind text,
  section_position integer,
  has_words boolean,
  has_sound boolean,
  gap text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT public.is_song_member(_song_id, auth.uid()) AS ok
  ),
  s AS (
    SELECT ss.id, ss.label, ss.kind::text AS kind, ss.position AS pos
    FROM public.song_sections ss, guard g
    WHERE g.ok AND ss.song_id = _song_id
  ),
  w AS (
    SELECT sl.section_id AS sid, bool_or(length(btrim(coalesce(sl.plain_text,''))) > 0) AS has_words
    FROM public.song_lyrics sl
    WHERE sl.song_id = _song_id
    GROUP BY sl.section_id
  ),
  a AS (
    SELECT vm.section_id AS sid, true AS has_sound
    FROM public.voice_memos vm
    WHERE vm.song_id = _song_id
      AND vm.section_id IS NOT NULL
      AND vm.status <> 'deleted'
    GROUP BY vm.section_id
  )
  SELECT
    s.id,
    coalesce(nullif(btrim(coalesce(s.label,'')), ''), initcap(replace(s.kind, '_', ' '))),
    s.kind,
    s.pos,
    coalesce(w.has_words, false),
    coalesce(a.has_sound, false),
    CASE
      WHEN NOT coalesce(w.has_words, false) AND NOT coalesce(a.has_sound, false) THEN 'empty'
      WHEN NOT coalesce(w.has_words, false) THEN 'no_words'
      WHEN NOT coalesce(a.has_sound, false) THEN 'no_sound'
      ELSE 'complete'
    END
  FROM s
  LEFT JOIN w ON w.sid = s.id
  LEFT JOIN a ON a.sid = s.id
  ORDER BY s.pos;
$$;

REVOKE ALL ON FUNCTION public.song_gaps(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_gaps(uuid) TO authenticated;