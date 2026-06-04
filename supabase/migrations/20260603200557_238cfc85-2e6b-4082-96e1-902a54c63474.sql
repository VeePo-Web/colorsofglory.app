
-- Exports bucket: path = {owner_user_id}/{song_id}/{filename}
CREATE POLICY "Owners can read own exports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

CREATE POLICY "Owners can write own exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

CREATE POLICY "Owners can update own exports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

CREATE POLICY "Owners can delete own exports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

-- Avatars bucket: path = {user_id}/{filename}
CREATE POLICY "Authenticated can read avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can write own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1]::uuid = auth.uid()
);
