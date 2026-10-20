-- Permit formateurs to correct notes only for their assigned courses.
drop policy if exists grade_entries_update_staff on public.grade_entries;
create policy grade_entries_update_staff on public.grade_entries
for update to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (
    (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
    or (
      (select p.role from public.profiles p where p.id = auth.uid()) = 'formateur'
      and exists (
        select 1 from public.grade_evaluations e
        join public.cours c on c.id::text = e.cours_id
        join public.formateurs f on f.id::text = c.formateur_id::text
        where e.id = grade_entries.evaluation_id and e.centre_id = grade_entries.centre_id
          and c.centre_id = grade_entries.centre_id
          and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    )
  )
) with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id and note <= e.note_max
  )
);
