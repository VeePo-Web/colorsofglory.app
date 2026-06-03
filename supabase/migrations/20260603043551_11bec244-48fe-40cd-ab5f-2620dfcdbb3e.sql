
-- Enums
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE public.version_kind AS ENUM ('manual', 'auto', 'restore_point');

-- =========================================================================
-- Helper: current_invite_expiry()
-- =========================================================================
CREATE OR REPLACE FUNCTION public.current_invite_expiry()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hrs int;
BEGIN
  SELECT COALESCE((value::text)::int, 168) INTO hrs
    FROM public.app_settings
    WHERE key = 'invite_expiry_hours';
  RETURN now() + make_interval(hours => COALESCE(hrs, 168));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.current_invite_expiry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_invite_expiry() TO authenticated, service_role;

-- =========================================================================
-- song_invites
-- =========================================================================
CREATE TABLE public.song_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  invited_email text,
  invited_phone text,
  role public.song_member_role NOT NULL DEFAULT 'collaborator',
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_by_user_id uuid NOT NULL,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT public.current_invite_expiry(),
  max_uses int NOT NULL DEFAULT 1,
  use_count int NOT NULL DEFAULT 0,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_invites_role_not_owner CHECK (role <> 'owner'),
  CONSTRAINT song_invites_max_uses_positive CHECK (max_uses >= 1),
  CONSTRAINT song_invites_use_count_nonneg CHECK (use_count >= 0)
);

GRANT SELECT ON public.song_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_invites TO authenticated;
GRANT ALL ON public.song_invites TO service_role;
ALTER TABLE public.song_invites ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Helper: is_invite_valid (after table exists)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_invite_valid(_invite_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.song_invites
    WHERE id = _invite_id
      AND status = 'pending'
      AND now() < expires_at
      AND use_count < max_uses
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_invite_valid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_invite_valid(uuid) TO anon, authenticated, service_role;

-- RLS: anon preview (valid invites only). Token is the secret; clients filter by it.
CREATE POLICY "Anon can preview valid invites" ON public.song_invites
  FOR SELECT TO anon
  USING (public.is_invite_valid(id));

CREATE POLICY "Members or invitee can view invites" ON public.song_invites
  FOR SELECT TO authenticated
  USING (
    public.is_song_member(song_id, auth.uid())
    OR invited_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "Owner can create invites" ON public.song_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_song_owner(song_id, auth.uid())
    AND created_by_user_id = auth.uid()
    AND role <> 'owner'
  );

CREATE POLICY "Owner can update invites" ON public.song_invites
  FOR UPDATE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()))
  WITH CHECK (public.is_song_owner(song_id, auth.uid()));

CREATE POLICY "Owner can delete invites" ON public.song_invites
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_song_invites_song_status ON public.song_invites(song_id, status);
CREATE INDEX idx_song_invites_email ON public.song_invites(invited_email);
CREATE INDEX idx_song_invites_expires ON public.song_invites(expires_at);

CREATE TRIGGER update_song_invites_updated_at
BEFORE UPDATE ON public.song_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER touch_activity_on_song_invites
AFTER INSERT OR UPDATE OR DELETE ON public.song_invites
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

ALTER TABLE public.song_invites REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_invites;

-- =========================================================================
-- song_versions
-- =========================================================================
CREATE TABLE public.song_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 0,
  kind public.version_kind NOT NULL DEFAULT 'manual',
  label text,
  description text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL,
  parent_version_id uuid REFERENCES public.song_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, version_number)
);

GRANT SELECT, INSERT, DELETE ON public.song_versions TO authenticated;
GRANT ALL ON public.song_versions TO service_role;
ALTER TABLE public.song_versions ENABLE ROW LEVEL SECURITY;

-- Helper: next_song_version_number
CREATE OR REPLACE FUNCTION public.next_song_version_number(_song_id uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(version_number), 0) + 1
  FROM public.song_versions
  WHERE song_id = _song_id;
$$;
REVOKE EXECUTE ON FUNCTION public.next_song_version_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_song_version_number(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_song_version_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 0 THEN
    NEW.version_number := public.next_song_version_number(NEW.song_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_song_version_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER before_song_versions_insert
BEFORE INSERT ON public.song_versions
FOR EACH ROW EXECUTE FUNCTION public.set_song_version_number();

CREATE POLICY "Members can view versions" ON public.song_versions
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can create versions" ON public.song_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_song_member(song_id, auth.uid())
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Owners can delete versions" ON public.song_versions
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_song_versions_song_number ON public.song_versions(song_id, version_number DESC);
CREATE INDEX idx_song_versions_creator ON public.song_versions(created_by_user_id);

CREATE TRIGGER touch_activity_on_song_versions
AFTER INSERT OR DELETE ON public.song_versions
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();
