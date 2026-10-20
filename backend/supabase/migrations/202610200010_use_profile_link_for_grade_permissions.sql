-- Use the authenticated profile-to-teacher link used by SchoolPlans planning.
create or replace function public.grade_can_manage_course(p_centre_id uuid, p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.centre_id = p_centre_id
      and p.role in ('admin','director')
  ) or exists (
    select 1
    from public.profiles p
    join public.formateurs f on f.profile_id = p.id and f.centre_id = p_centre_id
    join public.cours c on c.formateur_id::text = f.id::text and c.centre_id = p_centre_id
    where p.id = auth.uid()
      and p.role = 'formateur'
      and c.id::text = p_course_id
  );
$$;
revoke all on function public.grade_can_manage_course(uuid,text) from public;
grant execute on function public.grade_can_manage_course(uuid,text) to authenticated;

drop policy if exists grade_evaluations_read_centre on public.grade_evaluations;
create policy grade_evaluations_read_centre on public.grade_evaluations
for select to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and public.grade_can_manage_course(centre_id, cours_id)
);
drop policy if exists grade_evaluations_insert_staff on public.grade_evaluations;
create policy grade_evaluations_insert_staff on public.grade_evaluations
for insert to authenticated with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and public.grade_can_manage_course(centre_id, cours_id)
);
drop policy if exists grade_evaluations_update_staff on public.grade_evaluations;
create policy grade_evaluations_update_staff on public.grade_evaluations
for update to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and public.grade_can_manage_course(centre_id, cours_id)
) with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and public.grade_can_manage_course(centre_id, cours_id)
);

drop policy if exists grade_entries_read_staff on public.grade_entries;
create policy grade_entries_read_staff on public.grade_entries
for select to authenticated using (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
      and public.grade_can_manage_course(e.centre_id, e.cours_id)
  )
);
drop policy if exists grade_entries_insert_staff on public.grade_entries;
create policy grade_entries_insert_staff on public.grade_entries
for insert to authenticated with check (
  public.mc_droit('notes_bulletins')
  and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (
    select 1 from public.grade_evaluations e
    where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
      and note <= e.note_max and public.grade_can_manage_course(e.centre_id, e.cours_id)
  )
  and exists (
    select 1 from public.etudiants s where s.id::text = student_id and s.centre_id = grade_entries.centre_id
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
  )
);
