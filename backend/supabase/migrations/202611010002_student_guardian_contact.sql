alter table public.etudiants
  add column if not exists nom_parent text,
  add column if not exists email_parent text,
  add column if not exists ville_parent text;
