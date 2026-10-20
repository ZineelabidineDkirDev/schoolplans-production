-- Dedicated guardian contact for absence alerts; keep the student's own phone separate.
alter table public.etudiants
  add column if not exists telephone_parent text;
