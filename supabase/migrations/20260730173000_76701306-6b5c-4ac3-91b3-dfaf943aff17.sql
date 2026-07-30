CREATE TABLE public.song_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  include_audio boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX song_share_links_song_idx ON public.song_share_links (song_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_share_links TO authenticated;
GRANT ALL ON public.song_share_links TO service_role;

ALTER TABLE public.song_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view share links"
ON public.song_share_links FOR SELECT TO authenticated
USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Owners manage share links"
ON public.song_share_links FOR ALL TO authenticated
USING (public.song_role(song_id, auth.uid()) = 'owner')
WITH CHECK (public.song_role(song_id, auth.uid()) = 'owner');

CREATE TRIGGER song_share_links_updated_at
BEFORE UPDATE ON public.song_share_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Owner creates a link -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_song_share_link(
  _song_id uuid,
  _label text DEFAULT NULL,
  _include_audio boolean DEFAULT true,
  _expires_in_days integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tok text;
  _row public.song_share_links;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.song_role(_song_id, _uid) <> 'owner' THEN
    RAISE EXCEPTION 'owner_only';
  END IF;

  _tok := replace(encode(gen_random_bytes(18), 'base64'), '/', '_');
  _tok := replace(replace(_tok, '+', '-'), '=', '');

  INSERT INTO public.song_share_links (song_id, token, label, include_audio, created_by_user_id, expires_at)
  VALUES (
    _song_id, _tok, nullif(btrim(coalesce(_label, '')), ''), coalesce(_include_audio, true), _uid,
    CASE WHEN _expires_in_days IS NULL THEN NULL ELSE now() + make_interval(days => _expires_in_days) END
  )
  RETURNING * INTO _row;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, _uid, 'share_link_created', 'share_link', _row.id, jsonb_build_object('include_audio', _row.include_audio));

  RETURN to_jsonb(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_song_share_link(_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.song_share_links;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _row FROM public.song_share_links WHERE id = _link_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF public.song_role(_row.song_id, _uid) <> 'owner' THEN RAISE EXCEPTION 'owner_only'; END IF;

  UPDATE public.song_share_links
     SET revoked_at = now()
   WHERE id = _link_id AND revoked_at IS NULL
  RETURNING * INTO _row;

  RETURN to_jsonb(coalesce(_row, (SELECT s FROM public.song_share_links s WHERE s.id = _link_id)));
END;
$$;

CREATE OR REPLACE FUNCTION public.song_share_links_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'not_a_member'; END IF;

  RETURN jsonb_build_object(
    'can_manage', public.song_role(_song_id, _uid) = 'owner',
    'links', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'token', l.token,
        'label', l.label,
        'include_audio', l.include_audio,
        'expires_at', l.expires_at,
        'revoked_at', l.revoked_at,
        'view_count', l.view_count,
        'last_viewed_at', l.last_viewed_at,
        'created_at', l.created_at,
        'is_live', l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now())
      ) ORDER BY l.created_at DESC)
      FROM public.song_share_links l WHERE l.song_id = _song_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Public read-only view by token --------------------------------------------
CREATE OR REPLACE FUNCTION public.song_shared_view(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.song_share_links;
  _song public.songs;
BEGIN
  SELECT * INTO _link FROM public.song_share_links WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF _link.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'link_revoked'; END IF;
  IF _link.expires_at IS NOT NULL AND _link.expires_at <= now() THEN RAISE EXCEPTION 'link_expired'; END IF;

  SELECT * INTO _song FROM public.songs WHERE id = _link.song_id;
  IF NOT FOUND OR _song.status IN ('deleted') THEN RAISE EXCEPTION 'song_unavailable'; END IF;

  UPDATE public.song_share_links
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE id = _link.id;

  RETURN jsonb_build_object(
    'song', jsonb_build_object(
      'title', _song.title,
      'key_signature', _song.key_signature,
      'tempo_bpm', _song.tempo_bpm,
      'time_signature', _song.time_signature,
      'dedication', _song.dedication,
      'updated_at', _song.updated_at
    ),
    'owner_name', (SELECT coalesce(p.display_name, 'A songwriter') FROM public.profiles p WHERE p.user_id = _song.owner_user_id),
    'include_audio', _link.include_audio,
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section_id', s.id,
        'label', coalesce(s.label, initcap(replace(s.kind::text, '_', ' '))),
        'kind', s.kind,
        'position', s.position,
        'plain_text', coalesce(sl.plain_text, ''),
        'content', sl.content
      ) ORDER BY s.position)
      FROM public.song_sections s
      LEFT JOIN public.song_lyrics sl ON sl.section_id = s.id
      WHERE s.song_id = _song.id
    ), '[]'::jsonb),
    'takes', CASE WHEN _link.include_audio THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'take_id', t.id,
        'name', coalesce(t.friendly_name, 'Take'),
        'duration_ms', t.duration_ms,
        'waveform_peaks', t.waveform_peaks,
        'storage_path', t.storage_path,
        'created_at', t.created_at
      ) ORDER BY t.is_primary DESC, t.created_at)
      FROM public.takes t
      WHERE t.song_id = _song.id AND t.is_archived = false
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_shared_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_shared_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_song_share_link(uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_song_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_share_links_board(uuid) TO authenticated;