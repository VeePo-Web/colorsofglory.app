CREATE OR REPLACE FUNCTION public.rename_song_section(
  _section_id uuid,
  _label text,
  _kind section_kind DEFAULT NULL
)
RETURNS public.song_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.song_sections;
  v_label text;
BEGIN
  SELECT * INTO v_row FROM public.song_sections WHERE id = _section_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_song_write(v_row.song_id);

  v_label := NULLIF(btrim(coalesce(_label, '')), '');
  IF v_label IS NOT NULL AND length(v_label) > 60 THEN
    v_label := left(v_label, 60);
  END IF;

  UPDATE public.song_sections
     SET label = v_label,
         kind = COALESCE(_kind, kind),
         updated_at = now()
   WHERE id = _section_id
  RETURNING * INTO v_row;

  PERFORM public.log_song_activity(
    v_row.song_id, 'section_renamed', 'song_section', v_row.id,
    jsonb_build_object('kind', v_row.kind, 'has_label', v_label IS NOT NULL)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_song_section(uuid, text, section_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_song_section(uuid, text, section_kind) TO authenticated;