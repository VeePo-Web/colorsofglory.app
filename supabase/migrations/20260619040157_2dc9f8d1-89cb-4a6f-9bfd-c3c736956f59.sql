
-- 1. song_notification_prefs.last_seen_at
ALTER TABLE public.song_notification_prefs
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;

-- 2. song_activity table
CREATE TABLE IF NOT EXISTS public.song_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_activity_kind_check CHECK (kind IN (
    'take_committed','capture_created','capture_promoted',
    'memo_uploaded','memo_finalized','memo_transcribed',
    'invite_accepted','member_left','owner_transferred',
    'card_moved','card_linked','card_unlinked','card_grouped',
    'card_section_set','card_promoted_final','card_deleted'
  ))
);

GRANT SELECT ON public.song_activity TO authenticated;
GRANT ALL ON public.song_activity TO service_role;

ALTER TABLE public.song_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS song_activity_member_select ON public.song_activity;
CREATE POLICY song_activity_member_select ON public.song_activity
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE INDEX IF NOT EXISTS song_activity_song_created_idx
  ON public.song_activity (song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS song_activity_song_actor_idx
  ON public.song_activity (song_id, actor_user_id, created_at DESC);

-- 3. Writer helper (only callable from SECURITY DEFINER scope or service_role)
CREATE OR REPLACE FUNCTION public.log_song_activity(
  _song_id uuid,
  _kind text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _song_id IS NULL OR _kind IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, auth.uid(), _kind, _entity_type, _entity_id, COALESCE(_payload, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_song_activity(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_song_activity(uuid, text, text, uuid, jsonb) TO service_role;

-- 4. Digest reader: grouped activity since a timestamp
CREATE OR REPLACE FUNCTION public.list_song_activity_since(
  _song_id uuid,
  _since timestamptz,
  _limit integer DEFAULT 200
) RETURNS TABLE (
  kind text,
  actor_user_id uuid,
  event_count integer,
  last_at timestamptz,
  sample_entity_ids uuid[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 200), 1), 1000);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT a.kind, a.actor_user_id, a.entity_id, a.created_at
      FROM public.song_activity a
     WHERE a.song_id = _song_id
       AND a.created_at > COALESCE(_since, 'epoch'::timestamptz)
     ORDER BY a.created_at DESC
     LIMIT v_limit
  )
  SELECT b.kind,
         b.actor_user_id,
         COUNT(*)::int                                   AS event_count,
         MAX(b.created_at)                               AS last_at,
         (ARRAY_AGG(b.entity_id) FILTER (WHERE b.entity_id IS NOT NULL))[1:5] AS sample_entity_ids
    FROM base b
   GROUP BY b.kind, b.actor_user_id
   ORDER BY MAX(b.created_at) DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.list_song_activity_since(uuid, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_song_activity_since(uuid, timestamptz, integer) TO authenticated;

-- 5. Mark song seen
CREATE OR REPLACE FUNCTION public.mark_song_seen(_song_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.song_notification_prefs (user_id, song_id, last_seen_at)
  VALUES (auth.uid(), _song_id, now())
  ON CONFLICT (user_id, song_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_song_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_song_seen(uuid) TO authenticated;

-- 6. Retro-fit canvas RPCs to log activity
CREATE OR REPLACE FUNCTION public.canvas_move_card(
  _card_id uuid, _x real, _y real, _z_index integer DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  UPDATE public.canvas_cards
     SET x = _x, y = _y, z_index = COALESCE(_z_index, z_index), updated_at = now()
   WHERE id = _card_id RETURNING * INTO c;
  PERFORM public.log_song_activity(c.song_id, 'card_moved', 'canvas_card', c.id, '{}'::jsonb);
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_bulk_move(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE song uuid; n integer := 0;
BEGIN
  IF jsonb_typeof(_payload) <> 'array' THEN
    RAISE EXCEPTION 'payload_must_be_array' USING ERRCODE = '22023';
  END IF;
  SELECT DISTINCT cc.song_id INTO song FROM public.canvas_cards cc
   WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e);
  IF song IS NULL THEN RETURN 0; END IF;
  IF (SELECT count(DISTINCT cc.song_id) FROM public.canvas_cards cc
      WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e)) > 1 THEN
    RAISE EXCEPTION 'cross_song_payload' USING ERRCODE = '22023';
  END IF;
  PERFORM public._assert_canvas_write(song);
  WITH src AS (
    SELECT (e->>'id')::uuid AS id, (e->>'x')::real AS x, (e->>'y')::real AS y,
           NULLIF(e->>'z','')::integer AS z
    FROM jsonb_array_elements(_payload) e
  )
  UPDATE public.canvas_cards cc
     SET x = src.x, y = src.y, z_index = COALESCE(src.z, cc.z_index), updated_at = now()
    FROM src WHERE cc.id = src.id AND cc.song_id = song;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.log_song_activity(song, 'card_moved', 'canvas_card', NULL,
    jsonb_build_object('count', n));
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_link_cards(_parent_id uuid, _child_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE ps uuid; cs uuid; walker uuid; depth int := 0; result public.canvas_cards;
BEGIN
  IF _parent_id = _child_id THEN RAISE EXCEPTION 'self_link_forbidden' USING ERRCODE = '22023'; END IF;
  SELECT song_id INTO ps FROM public.canvas_cards WHERE id = _parent_id;
  SELECT song_id INTO cs FROM public.canvas_cards WHERE id = _child_id;
  IF ps IS NULL OR cs IS NULL THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  IF ps <> cs THEN RAISE EXCEPTION 'cross_song_link_forbidden' USING ERRCODE = '22023'; END IF;
  PERFORM public._assert_canvas_write(ps);
  walker := _parent_id;
  WHILE walker IS NOT NULL AND depth < 64 LOOP
    IF walker = _child_id THEN RAISE EXCEPTION 'cycle_forbidden' USING ERRCODE = '22023'; END IF;
    SELECT parent_card_id INTO walker FROM public.canvas_cards WHERE id = walker;
    depth := depth + 1;
  END LOOP;
  UPDATE public.canvas_cards SET parent_card_id = _parent_id, updated_at = now()
   WHERE id = _child_id RETURNING * INTO result;
  PERFORM public.log_song_activity(ps, 'card_linked', 'canvas_card', _child_id,
    jsonb_build_object('parent_id', _parent_id));
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_unlink_card(_card_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  UPDATE public.canvas_cards SET parent_card_id = NULL, updated_at = now()
   WHERE id = _card_id RETURNING * INTO c;
  PERFORM public.log_song_activity(c.song_id, 'card_unlinked', 'canvas_card', c.id, '{}'::jsonb);
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_group_cards(_card_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE song uuid; new_group uuid := gen_random_uuid();
BEGIN
  IF _card_ids IS NULL OR array_length(_card_ids,1) IS NULL THEN
    RAISE EXCEPTION 'empty_card_ids' USING ERRCODE = '22023';
  END IF;
  SELECT DISTINCT cc.song_id INTO song FROM public.canvas_cards cc WHERE cc.id = ANY(_card_ids);
  IF (SELECT count(DISTINCT cc.song_id) FROM public.canvas_cards cc WHERE cc.id = ANY(_card_ids)) > 1 THEN
    RAISE EXCEPTION 'cross_song_group_forbidden' USING ERRCODE = '22023';
  END IF;
  IF song IS NULL THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(song);
  UPDATE public.canvas_cards SET group_id = new_group, updated_at = now()
   WHERE id = ANY(_card_ids);
  PERFORM public.log_song_activity(song, 'card_grouped', 'canvas_card', NULL,
    jsonb_build_object('group_id', new_group, 'count', array_length(_card_ids,1)));
  RETURN new_group;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_set_section(
  _card_id uuid, _section_label text, _tree_kind text DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  IF _tree_kind IS NOT NULL AND _tree_kind NOT IN ('ideas','final') THEN
    RAISE EXCEPTION 'invalid_tree_kind' USING ERRCODE = '22023';
  END IF;
  UPDATE public.canvas_cards
     SET section_label = _section_label,
         tree_kind = COALESCE(_tree_kind, tree_kind),
         updated_at = now()
   WHERE id = _card_id RETURNING * INTO c;
  PERFORM public.log_song_activity(c.song_id, 'card_section_set', 'canvas_card', c.id,
    jsonb_build_object('tree_kind', c.tree_kind));
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_promote_to_final(_card_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE src public.canvas_cards; dst public.canvas_cards;
BEGIN
  SELECT * INTO src FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(src.song_id);
  INSERT INTO public.canvas_cards (
    song_id, created_by, take_id, kind, section_kind, label, body,
    start_ms, end_ms, position, x, y,
    parent_card_id, group_id, tree_kind, section_label, z_index
  ) VALUES (
    src.song_id, auth.uid(), src.take_id, src.kind, src.section_kind, src.label, src.body,
    src.start_ms, src.end_ms, src.position, src.x, src.y,
    src.id, src.group_id, 'final', src.section_label, src.z_index
  ) RETURNING * INTO dst;
  PERFORM public.log_song_activity(src.song_id, 'card_promoted_final', 'canvas_card', dst.id,
    jsonb_build_object('source_card_id', src.id));
  RETURN dst;
END; $$;

-- Re-lock new function revisions
REVOKE EXECUTE ON FUNCTION public.canvas_move_card(uuid, real, real, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_bulk_move(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_link_cards(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_unlink_card(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_group_cards(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_set_section(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.canvas_promote_to_final(uuid) FROM PUBLIC, anon;

-- 7. Realtime publication
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.song_activity; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_cards; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.takes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.idea_captures; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.song_activity REPLICA IDENTITY FULL;
ALTER TABLE public.canvas_cards REPLICA IDENTITY FULL;
ALTER TABLE public.takes REPLICA IDENTITY FULL;
ALTER TABLE public.idea_captures REPLICA IDENTITY FULL;
