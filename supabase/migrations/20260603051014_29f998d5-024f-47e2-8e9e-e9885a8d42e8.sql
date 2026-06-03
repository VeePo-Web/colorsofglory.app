
-- 1. Expand memo_status enum
ALTER TYPE public.memo_status ADD VALUE IF NOT EXISTS 'uploaded';
ALTER TYPE public.memo_status ADD VALUE IF NOT EXISTS 'finalized';
ALTER TYPE public.memo_status ADD VALUE IF NOT EXISTS 'transcribed';
