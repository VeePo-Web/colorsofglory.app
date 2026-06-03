
-- Members can read voice memo files for songs they belong to
CREATE POLICY "Members can read voice memo files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-memos'
    AND public.is_song_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );

CREATE POLICY "Members can upload voice memo files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-memos'
    AND public.is_song_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );

CREATE POLICY "Members can update voice memo files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'voice-memos'
    AND public.is_song_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );

CREATE POLICY "Members can delete voice memo files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-memos'
    AND public.is_song_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );
