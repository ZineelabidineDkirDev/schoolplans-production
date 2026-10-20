-- Ensure a grade can only be recorded for a student enrolled in the evaluated course.
drop policy if exists grade_entries_insert_staff on public.grade_entries;
create policy grade_entries_insert_staff on public.grade_entries
for insert to authenticated with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
      and note <= e.note_max and public.grade_can_manage_course(e.centre_id, e.cours_id)
      and exists (
        select 1 from public.inscriptions i
        where i.centre_id = e.centre_id and i.cours_id::text = e.cours_id
          and i.etudiant_id::text = grade_entries.student_id
      )
  )
);
drop policy if exists grade_entries_update_staff on public.grade_entries;
create policy grade_entries_update_staff on public.grade_entries
for update to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
      and public.grade_can_manage_course(e.centre_id, e.cours_id)
  )
) with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
      and note <= e.note_max and public.grade_can_manage_course(e.centre_id, e.cours_id)
      and exists (
        select 1 from public.inscriptions i
        where i.centre_id = e.centre_id and i.cours_id::text = e.cours_id
          and i.etudiant_id::text = grade_entries.student_id
      )
  )
);
