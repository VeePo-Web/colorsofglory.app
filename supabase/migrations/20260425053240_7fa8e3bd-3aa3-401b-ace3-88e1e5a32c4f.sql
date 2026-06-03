-- Create the partnership-uploads bucket (public, image-only, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partnership-uploads',
  'partnership-uploads',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
);

-- Allow anyone to upload to this bucket
CREATE POLICY "Anyone can upload partnership images"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'partnership-uploads');

-- Allow anyone to view files in this bucket (emailed links must work)
CREATE POLICY "Anyone can view partnership images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'partnership-uploads');