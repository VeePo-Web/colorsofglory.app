CREATE OR REPLACE FUNCTION public.song_title_suggestions(_song_id uuid)
RETURNS TABLE (
  suggestion text,
  source text,
  weight integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT public.is_song_member(_song_id, auth.uid()) AS ok
  ),
  lines AS (
    SELECT
      s.kind::text AS section_kind,
      s.position AS section_position,
      ln.ord AS line_ord,
      btrim(ln.txt) AS txt
    FROM public.song_lyrics l
    JOIN public.song_sections s ON s.id = l.section_id
    CROSS JOIN LATERAL unnest(string_to_array(l.plain_text, E'\n')) WITH ORDINALITY AS ln(txt, ord)
    WHERE l.song_id = _song_id
      AND (SELECT ok FROM guard)
      AND length(btrim(ln.txt)) BETWEEN 2 AND 60
  ),
  repeated AS (
    SELECT txt, count(*)::int AS n
    FROM lines
    GROUP BY txt
    HAVING count(*) > 1
  ),
  candidates AS (
    SELECT txt AS suggestion, 'hook'::text AS source, 100 + LEAST(n, 9) AS weight
    FROM repeated
    UNION ALL
    SELECT txt, 'chorus'::text, 90
    FROM lines
    WHERE section_kind = 'chorus' AND line_ord = 1
    UNION ALL
    SELECT txt, 'opening'::text, 70
    FROM (
      SELECT txt FROM lines ORDER BY section_position ASC, line_ord ASC LIMIT 1
    ) o
  ),
  ranked AS (
    SELECT DISTINCT ON (lower(suggestion))
      suggestion, source, weight
    FROM candidates
    ORDER BY lower(suggestion), weight DESC
  )
  SELECT suggestion, source, weight
  FROM ranked
  ORDER BY weight DESC, length(suggestion) ASC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.song_title_suggestions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_title_suggestions(uuid) TO authenticated;