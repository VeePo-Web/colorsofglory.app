alter table public.contact_submissions
  add column if not exists services text[] null;
