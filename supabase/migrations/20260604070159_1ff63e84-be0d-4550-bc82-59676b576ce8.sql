
CREATE OR REPLACE FUNCTION public.onboarding_step_rank(_s onboarding_step)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _s
    WHEN 'not_started' THEN 0
    WHEN 'intent_selected' THEN 1
    WHEN 'referral_program_seen' THEN 2
    WHEN 'founder_code_seen' THEN 3
    WHEN 'first_song_created' THEN 4
    WHEN 'first_idea_captured' THEN 5
    WHEN 'first_voice_memo_added' THEN 6
    WHEN 'first_lyrics_added' THEN 7
    WHEN 'first_collaborator_invited' THEN 8
    WHEN 'completed' THEN 99
    WHEN 'dismissed' THEN 99
  END;
$$;

CREATE OR REPLACE FUNCTION public.onboarding_legal_next(_from onboarding_step)
RETURNS onboarding_step[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _from
    WHEN 'not_started' THEN ARRAY['intent_selected','dismissed']::public.onboarding_step[]
    WHEN 'intent_selected' THEN ARRAY['referral_program_seen','founder_code_seen','first_song_created','dismissed']::public.onboarding_step[]
    WHEN 'referral_program_seen' THEN ARRAY['founder_code_seen','first_song_created','dismissed']::public.onboarding_step[]
    WHEN 'founder_code_seen' THEN ARRAY['first_song_created','dismissed']::public.onboarding_step[]
    WHEN 'first_song_created' THEN ARRAY['first_idea_captured','first_voice_memo_added','first_lyrics_added','dismissed']::public.onboarding_step[]
    WHEN 'first_idea_captured' THEN ARRAY['first_voice_memo_added','first_lyrics_added','first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_voice_memo_added' THEN ARRAY['first_lyrics_added','first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_lyrics_added' THEN ARRAY['first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_collaborator_invited' THEN ARRAY['completed','dismissed']::public.onboarding_step[]
    ELSE ARRAY[]::public.onboarding_step[]
  END;
$$;
