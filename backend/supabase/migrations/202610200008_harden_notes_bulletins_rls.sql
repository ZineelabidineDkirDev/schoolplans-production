-- Tighten Notes & Bulletins access after the initial module migration.
drop policy if exists grade_evaluations_read_centre on public.grade_evaluations;
create policy grade_evaluations_read_centre on public.grade_evaluations
for select to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (
    (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
    or (
      (select p.role from public.profiles p where p.id = auth.uid()) = 'formateur'
      and exists (
        select 1 from public.cours c join public.formateurs f on f.id::text = c.formateur_id::text
        where c.id::text = grade_evaluations.cours_id and c.centre_id = grade_evaluations.centre_id
          and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    )
  )
);

drop policy if exists grade_entries_read_staff on public.grade_entries;
create policy grade_entries_read_staff on public.grade_entries
for select to authenticated using (
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
);

drop policy if exists grade_entries_insert_staff on public.grade_entries;
create policy grade_entries_insert_staff on public.grade_entries
for insert to authenticated with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id and note <= e.note_max
      and (
        (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
        or (
          (select p.role from public.profiles p where p.id = auth.uid()) = 'formateur'
          and exists (
            select 1 from public.cours c join public.formateurs f on f.id::text = c.formateur_id::text
            where c.id::text = e.cours_id and c.centre_id = e.centre_id
              and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email',''))
          )
        )
      )
  )
  and exists (select 1 from public.etudiants s where s.id::text = student_id and s.centre_id = grade_entries.centre_id)
);

drop policy if exists grade_entries_update_staff on public.grade_entries;
create policy grade_entries_update_staff on public.grade_entries
for update to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
) with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (select 1 from public.grade_evaluations e where e.id = evaluation_id and e.centre_id = grade_entries.centre_id and note <= e.note_max)
);
