alter table public.etudiants
  add column if not exists created_at timestamptz;

alter table public.etudiants
  alter column created_at set default now();
