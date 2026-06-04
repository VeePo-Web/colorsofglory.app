
REVOKE EXECUTE ON FUNCTION public.advance_onboarding(uuid, public.onboarding_step, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.advance_onboarding_for_song_owner(uuid, public.onboarding_step, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_song_insert_onboarding() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_voice_memo_insert_onboarding() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_song_lyric_insert_onboarding() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_song_note_insert_onboarding() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_song_invite_insert_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_onboarding(uuid, public.onboarding_step, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid) TO service_role, authenticated;
