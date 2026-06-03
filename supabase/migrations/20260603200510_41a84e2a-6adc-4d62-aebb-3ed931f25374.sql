
REVOKE EXECUTE ON FUNCTION public.owned_active_song_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_create_song(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_upload_bytes(uuid, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_invite(uuid, uuid) FROM PUBLIC;
