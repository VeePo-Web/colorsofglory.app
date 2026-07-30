
-- R26: line-level lyric suggestions ---------------------------------------

DO $$ BEGIN
  CREATE TYPE public.suggestion_status AS ENUM ('open', 'accepted', 'declined', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.lyric_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.song_sections(id) ON DELETE CASCADE,
  line_id text NOT NULL,
  original_text text NOT NULL DEFAULT '',
  suggested_text text NOT NULL,
  note text,
  author_user_id uuid NOT NULL,
  status public.suggestion_status NOT NULL DEFAULT 'open',
  resolved_by_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lyric_suggestions_song_open_idx
  ON public.lyric_suggestions (song_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.lyric_suggestions TO authenticated;
GRANT ALL ON public.lyric_suggestions TO service_role;

ALTER TABLE public.lyric_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read suggestions" ON public.lyric_suggestions;
CREATE POLICY "Members read suggestions"
  ON public.lyric_suggestions FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

DROP POLICY IF EXISTS "Writers create suggestions" ON public.lyric_suggestions;
CREATE POLICY "Writers create suggestions"
  ON public.lyric_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND public.song_role(song_id, auth.uid()) IN ('owner', 'collaborator')
  );

DROP POLICY IF EXISTS "Owner or author resolves suggestions" ON public.lyric_suggestions;
CREATE POLICY "Owner or author resolves suggestions"
  ON public.lyric_suggestions FOR UPDATE TO authenticated
  USING (public.song_role(song_id, auth.uid()) = 'owner' OR author_user_id = auth.uid())
  WITH CHECK (public.song_role(song_id, auth.uid()) = 'owner' OR author_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._lyric_suggestions_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS lyric_suggestions_touch ON public.lyric_suggestions;
CREATE TRIGGER lyric_suggestions_touch BEFORE UPDATE ON public.lyric_suggestions
  FOR EACH ROW EXECUTE FUNCTION public._lyric_suggestions_touch();

-- Board: every open suggestion, resolved for the review sheet ---------------
CREATE OR REPLACE FUNCTION public.song_suggestions_board(_song_id uuid, _include_resolved boolean DEFAULT false)
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
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.section_position, r.created_at), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      s.id,
      s.section_id,
      COALESCE(sec.label, sec.kind::text) AS section_label,
      sec.position AS section_position,
      s.line_id,
      s.original_text,
      s.suggested_text,
      s.note,
      s.status::text AS status,
      s.author_user_id,
      p.display_name AS author_name,
      p.avatar_url AS author_avatar_url,
      p.avatar_color AS author_avatar_color,
      (s.author_user_id = _uid) AS is_mine,
      s.created_at,
      s.resolved_at
    FROM public.lyric_suggestions s
    JOIN public.song_sections sec ON sec.id = s.section_id
    LEFT JOIN public.profiles p ON p.user_id = s.author_user_id
    WHERE s.song_id = _song_id
      AND (_include_resolved OR s.status = 'open')
  ) r;

  RETURN jsonb_build_object(
    'song_id', _song_id,
    'role', public.song_role(_song_id, _uid),
    'open_count', (SELECT count(*) FROM public.lyric_suggestions x WHERE x.song_id = _song_id AND x.status = 'open'),
    'suggestions', _rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_suggestions_board(uuid, boolean) TO authenticated;

-- Create -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_lyric_suggestion(
  _section_id uuid,
  _line_id text,
  _suggested_text text,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _song_id uuid;
  _original text := '';
  _id uuid;
BEGIN
  SELECT song_id INTO _song_id FROM public.song_sections WHERE id = _section_id;
  IF _song_id IS NULL THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_song_write(_song_id);

  IF coalesce(btrim(_suggested_text), '') = '' THEN
    RAISE EXCEPTION 'empty_suggestion' USING ERRCODE = '22023';
  END IF;

  SELECT ln->>'text' INTO _original
  FROM public.song_lyrics sl,
       LATERAL jsonb_array_elements(COALESCE(sl.content->'lines', '[]'::jsonb)) ln
  WHERE sl.section_id = _section_id AND ln->>'id' = _line_id
  LIMIT 1;

  INSERT INTO public.lyric_suggestions
    (song_id, section_id, line_id, original_text, suggested_text, note, author_user_id)
  VALUES
    (_song_id, _section_id, _line_id, COALESCE(_original, ''), btrim(_suggested_text),
     NULLIF(btrim(COALESCE(_note, '')), ''), auth.uid())
  RETURNING id INTO _id;

  PERFORM public.log_song_activity(_song_id, 'suggestion_created', 'lyric_suggestion', _id,
    jsonb_build_object('section_id', _section_id));

  UPDATE public.songs SET last_activity_at = now() WHERE id = _song_id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lyric_suggestion(uuid, text, text, text) TO authenticated;

-- Resolve: accept / decline / withdraw --------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_lyric_suggestion(_suggestion_id uuid, _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.lyric_suggestions;
  _role text;
  _uid uuid := auth.uid();
  _content jsonb;
  _new_lines jsonb;
  _applied boolean := false;
BEGIN
  SELECT * INTO _s FROM public.lyric_suggestions WHERE id = _suggestion_id;
  IF _s.id IS NULL THEN
    RAISE EXCEPTION 'suggestion_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _s.status <> 'open' THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  _role := public.song_role(_s.song_id, _uid);

  IF _action = 'withdraw' THEN
    IF _s.author_user_id <> _uid THEN
      RAISE EXCEPTION 'not_the_author' USING ERRCODE = '42501';
    END IF;
  ELSIF _action IN ('accept', 'decline') THEN
    IF _role NOT IN ('owner', 'collaborator') THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'unknown_action' USING ERRCODE = '22023';
  END IF;

  IF _action = 'accept' THEN
    SELECT content INTO _content FROM public.song_lyrics WHERE section_id = _s.section_id FOR UPDATE;

    IF _content IS NULL OR _content->'lines' IS NULL THEN
      RAISE EXCEPTION 'line_not_found' USING ERRCODE = 'P0002';
    END IF;

    SELECT jsonb_agg(
             CASE WHEN ln->>'id' = _s.line_id
                  THEN jsonb_set(
                         ln,
                         '{text}',
                         to_jsonb(_s.suggested_text)
                       )
                  ELSE ln END
             ORDER BY ord)
    INTO _new_lines
    FROM jsonb_array_elements(_content->'lines') WITH ORDINALITY AS t(ln, ord);

    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_content->'lines') ln WHERE ln->>'id' = _s.line_id
    ) THEN
      RAISE EXCEPTION 'line_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- clamp chord anchors that now sit past the end of the new line
    SELECT jsonb_agg(
             CASE WHEN ln->>'id' = _s.line_id
                  THEN jsonb_set(ln, '{anchors}', COALESCE((
                         SELECT jsonb_agg(jsonb_set(a, '{at}',
                                  to_jsonb(LEAST((a->>'at')::int, length(_s.suggested_text)))))
                         FROM jsonb_array_elements(COALESCE(ln->'anchors', '[]'::jsonb)) a
                       ), '[]'::jsonb))
                  ELSE ln END
             ORDER BY ord)
    INTO _new_lines
    FROM jsonb_array_elements(_new_lines) WITH ORDINALITY AS t(ln, ord);

    UPDATE public.song_lyrics
       SET content = jsonb_set(_content, '{lines}', _new_lines),
           plain_text = (
             SELECT string_agg(ln->>'text', E'\n' ORDER BY ord)
             FROM jsonb_array_elements(_new_lines) WITH ORDINALITY AS t(ln, ord)
           ),
           updated_by_user_id = _uid,
           updated_at = now()
     WHERE section_id = _s.section_id;

    _applied := true;
  END IF;

  UPDATE public.lyric_suggestions
     SET status = CASE _action
                    WHEN 'accept' THEN 'accepted'::public.suggestion_status
                    WHEN 'decline' THEN 'declined'::public.suggestion_status
                    ELSE 'withdrawn'::public.suggestion_status END,
         resolved_by_user_id = _uid,
         resolved_at = now()
   WHERE id = _suggestion_id;

  PERFORM public.log_song_activity(_s.song_id, 'suggestion_' || _action || 'ed', 'lyric_suggestion', _suggestion_id,
    jsonb_build_object('section_id', _s.section_id, 'applied', _applied));

  UPDATE public.songs SET last_activity_at = now() WHERE id = _s.song_id;

  RETURN jsonb_build_object('id', _suggestion_id, 'action', _action, 'applied', _applied);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_lyric_suggestion(uuid, text) TO authenticated;
