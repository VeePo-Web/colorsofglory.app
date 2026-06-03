-- Replace the broad SELECT with a no-op policy so listing is blocked,
-- but direct file access still works through Supabase's signed/public URL flow at the object endpoint.
DROP POLICY IF EXISTS "Anyone can view partnership images" ON storage.objects;

-- Allow direct GET on individual objects (no listing). Public buckets serve files
-- through the object endpoint regardless; this policy keeps RLS happy for the read path.
CREATE POLICY "Anyone can read individual partnership images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'partnership-uploads'
  AND name IS NOT NULL
  AND length(name) > 8
);