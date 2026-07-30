
-- R25: Listen Path -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.song_listen_paths (
  song_id uuid PRIMARY KEY REFERENCES public.songs(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_listen_paths TO authenticated;
GRANT ALL ON public.song_listen_paths TO service_role;

ALTER TABLE public.song_listen_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read listen path" ON public.song_listen_paths;
CREATE POLICY "Members read listen path"
  ON public.song_listen_paths FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

DROP POLICY IF EXISTS "Writers change listen path" ON public.song_listen_paths;
CREATE POLICY "Writers change listen path"
  ON public.song_listen_paths FOR ALL TO authenticated
  USING (public.song_role(song_id, auth.uid()) IN ('owner', 'collaborator'))
  WITH CHECK (public.song_role(song_id, auth.uid()) IN ('owner', 'collaborator'));

-- Board: the path, resolved for the player ---------------------------------
CREATE OR REPLACE FUNCTION public.song_listen_path(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _items jsonb;
  _resolved jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT lp.items INTO _items FROM public.song_listen_paths lp WHERE lp.song_id = _song_id;
  _items := COALESCE(_items, '[]'::jsonb);

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.position), '[]'::jsonb)
  INTO _resolved
  FROM (
    SELECT
      (it.ord - 1)::int AS position,
      it.value->>'kind' AS kind,
      (it.value->>'section_id')::uuid AS section_id,
      (it.value->>'take_id')::uuid AS take_id,
      COALESCE(sec.label, sec.kind::text) AS section_label,
      tk.friendly_name AS take_name,
      tk.duration_ms,
      tk.storage_path,
      tk.is_archived AS take_archived
    FROM jsonb_array_elements(_items) WITH ORDINALITY AS it(value, ord)
    LEFT JOIN public.song_sections sec
      ON sec.id = (it.value->>'section_id')::uuid AND sec.song_id = _song_id
    LEFT JOIN public.takes tk
      ON tk.id = (it.value->>'take_id')::uuid AND tk.song_id = _song_id
  ) r;

  RETURN jsonb_build_object(
    'song_id', _song_id,
    'role', public.song_role(_song_id, _uid),
    'items', _resolved,
    'total_duration_ms', (
      SELECT COALESCE(sum((x->>'duration_ms')::bigint), 0)
      FROM jsonb_array_elements(_resolved) x
    ),
    'updated_at', (SELECT lp.updated_at FROM public.song_listen_paths lp WHERE lp.song_id = _song_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_listen_path(uuid) TO authenticated;

-- Save the whole path in one write -----------------------------------------
CREATE OR REPLACE FUNCTION public.save_listen_path(_song_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean jsonb;
BEGIN
  PERFORM public._assert_song_write(_song_id);

  -- keep only items that still point at something real in THIS song
  SELECT COALESCE(jsonb_agg(it.value ORDER BY it.ord), '[]'::jsonb)
  INTO _clean
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS it(value, ord)
  WHERE (
    (it.value->>'take_id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.takes t WHERE t.id = (it.value->>'take_id')::uuid AND t.song_id = _song_id)
  ) OR (
    (it.value->>'section_id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.song_sections s WHERE s.id = (it.value->>'section_id')::uuid AND s.song_id = _song_id)
  );

  INSERT INTO public.song_listen_paths (song_id, items, updated_by_user_id, updated_at)
  VALUES (_song_id, _clean, auth.uid(), now())
  ON CONFLICT (song_id)
  DO UPDATE SET items = EXCLUDED.items,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = now();

  PERFORM public.log_song_activity(_song_id, 'listen_path_updated', 'song', _song_id,
    jsonb_build_object('item_count', jsonb_array_length(_clean)));

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN public.song_listen_path(_song_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_listen_path(uuid, jsonb) TO authenticated;
