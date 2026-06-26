
CREATE TABLE IF NOT EXISTS public.email_otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup','login','reset')),
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eov_email_purpose ON public.email_otp_verifications(email_hash, purpose, created_at DESC);
GRANT ALL ON public.email_otp_verifications TO service_role;
ALTER TABLE public.email_otp_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.email_otp_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);
