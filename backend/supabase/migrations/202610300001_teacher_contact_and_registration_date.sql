alter table public.formateurs
  add column if not exists telephone text;

alter table public.formateurs
  add column if not exists created_at timestamptz;

alter table public.formateurs
  alter column created_at set default now();
