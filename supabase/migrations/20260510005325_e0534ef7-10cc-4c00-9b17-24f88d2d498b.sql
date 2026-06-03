DROP POLICY "Anyone can submit contact enquiries" ON public.contact_submissions;

CREATE POLICY "Anyone can submit contact enquiries"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(name) BETWEEN 1 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND (phone IS NULL OR char_length(phone) <= 30)
  AND char_length(project) BETWEEN 1 AND 2000
);
