-- A bulletin is unique for a student, formation and period.
alter table public.grade_bulletins
  drop constraint if exists grade_bulletins_centre_id_student_id_periode_key;
create unique index if not exists grade_bulletins_centre_student_formation_period_uidx
  on public.grade_bulletins(centre_id, student_id, formation_id, periode);
