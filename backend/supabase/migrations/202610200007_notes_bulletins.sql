-- SchoolPlans Notes & Bulletins
-- A centre must explicitly enable the module in centres.droits.notes_bulletins.

create or replace function public.mc_droit(p_droit text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_centre_id uuid;
  v_droits jsonb;
begin
  if auth.uid() is null then return false; end if;
  select p.role, p.centre_id into v_role, v_centre_id
  from public.profiles p where p.id = auth.uid() limit 1;
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;
  if p_droit not in (
    'etudiants','formateurs','cours','planning','salles','presences','certificats',
    'supports','documents','statistiques','rapports','import_excel','export_excel',
    'seances','formations','groupes','cours_en_ligne','gestion_financiere','notes_bulletins'
  ) then return false; end if;
  if v_role not in ('admin','director','formateur','etudiant') or v_centre_id is null then return false; end if;
  select c.droits::jsonb into v_droits
  from public.centres c where c.id = v_centre_id and c.actif = true limit 1;
  if v_droits is null then return false; end if;
  return coalesce((v_droits ->> p_droit)::boolean, false);
end;
$$;
revoke all on function public.mc_droit(text) from public;
grant execute on function public.mc_droit(text) to authenticated;

create table if not exists public.grade_evaluations (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  titre text not null check (length(trim(titre)) > 0),
  periode text not null check (length(trim(periode)) > 0),
  cours_id text not null,
  note_max numeric(7,2) not null check (note_max > 0),
  coefficient numeric(7,3) not null default 1 check (coefficient > 0),
  cree_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists grade_evaluations_centre_period_idx on public.grade_evaluations(centre_id, periode);

create table if not exists public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  evaluation_id uuid not null references public.grade_evaluations(id) on delete cascade,
  student_id text not null,
  note numeric(7,2) not null check (note >= 0),
  tentative smallint not null default 1 check (tentative >= 1),
  note_initiale_id uuid references public.grade_entries(id) on delete set null,
  cree_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(evaluation_id, student_id, tentative)
);
create index if not exists grade_entries_centre_student_idx on public.grade_entries(centre_id, student_id);

create table if not exists public.grade_bulletins (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  student_id text not null,
  periode text not null,
  formation_id text,
  moyenne numeric(7,2),
  statut text not null default 'brouillon' check (statut in ('brouillon','soumis','valide','publie','a_corriger')),
  contenu jsonb not null default '{}'::jsonb,
  soumis_par uuid references auth.users(id) on delete set null,
  valide_par uuid references auth.users(id) on delete set null,
  valide_le timestamptz,
  publie_par uuid references auth.users(id) on delete set null,
  publie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(centre_id, student_id, periode)
);
create index if not exists grade_bulletins_centre_period_idx on public.grade_bulletins(centre_id, periode, statut);

alter table public.grade_evaluations enable row level security;
alter table public.grade_entries enable row level security;
alter table public.grade_bulletins enable row level security;

drop policy if exists grade_evaluations_read_centre on public.grade_evaluations;
create policy grade_evaluations_read_centre on public.grade_evaluations
for select to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
);
drop policy if exists grade_evaluations_insert_staff on public.grade_evaluations;
create policy grade_evaluations_insert_staff on public.grade_evaluations
for insert to authenticated with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (
    (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
    or (
      (select p.role from public.profiles p where p.id = auth.uid()) = 'formateur'
      and exists (
        select 1 from public.cours c join public.formateurs f on f.id::text = c.formateur_id::text
        where c.id::text = cours_id and c.centre_id = grade_evaluations.centre_id
          and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    )
  )
);
drop policy if exists grade_evaluations_update_staff on public.grade_evaluations;
create policy grade_evaluations_update_staff on public.grade_evaluations
for update to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
) with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists grade_entries_read_staff on public.grade_entries;
create policy grade_entries_read_staff on public.grade_entries for select to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
);
drop policy if exists grade_entries_insert_staff on public.grade_entries;
create policy grade_entries_insert_staff on public.grade_entries for insert to authenticated with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
  and exists (
    select 1 from public.grade_evaluations e where e.id = evaluation_id and e.centre_id = grade_entries.centre_id
  )
  and exists (
    select 1 from public.etudiants s where s.id::text = student_id and s.centre_id = grade_entries.centre_id
  )
);
drop policy if exists grade_entries_update_staff on public.grade_entries;
create policy grade_entries_update_staff on public.grade_entries for update to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
) with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and exists (select 1 from public.grade_evaluations e where e.id = evaluation_id and e.centre_id = grade_entries.centre_id)
);
drop policy if exists grade_entries_delete_staff on public.grade_entries;
create policy grade_entries_delete_staff on public.grade_entries for delete to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
);

drop policy if exists grade_bulletins_read_staff_or_owner on public.grade_bulletins;
create policy grade_bulletins_read_staff_or_owner on public.grade_bulletins for select to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (
    (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
    or (
      statut = 'publie' and exists (
        select 1 from public.etudiants s
        where s.id::text = student_id and s.centre_id = grade_bulletins.centre_id
          and lower(s.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    )
  )
);
drop policy if exists grade_bulletins_insert_staff on public.grade_bulletins;
create policy grade_bulletins_insert_staff on public.grade_bulletins for insert to authenticated with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director','formateur')
);
drop policy if exists grade_bulletins_update_director on public.grade_bulletins;
create policy grade_bulletins_update_director on public.grade_bulletins for update to authenticated using (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
) with check (
  public.mc_droit('notes_bulletins') and centre_id = (select p.centre_id from public.profiles p where p.id = auth.uid())
  and (select p.role from public.profiles p where p.id = auth.uid()) in ('admin','director')
);
