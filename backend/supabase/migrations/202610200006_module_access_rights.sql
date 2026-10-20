-- Module access rights: fail closed when a module is not explicitly enabled.
-- Apply this migration in the target Supabase project before deploying the UI.

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
  if auth.uid() is null then
    return false;
  end if;

  select p.role, p.centre_id
    into v_role, v_centre_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role = 'super_admin' then
    return true;
  end if;

  if p_droit not in (
    'etudiants', 'formateurs', 'cours', 'planning', 'salles',
    'presences', 'certificats', 'supports', 'documents',
    'statistiques', 'rapports', 'import_excel', 'export_excel',
    'seances', 'formations', 'groupes',
    'cours_en_ligne', 'gestion_financiere'
  ) then
    return false;
  end if;

  if v_role not in ('admin', 'director', 'formateur', 'etudiant')
     or v_centre_id is null then
    return false;
  end if;

  select c.droits::jsonb
    into v_droits
  from public.centres c
  where c.id = v_centre_id
    and c.actif = true
  limit 1;

  if v_droits is null then
    return false;
  end if;

  return coalesce((v_droits ->> p_droit)::boolean, false);
end;
$$;

revoke all on function public.mc_droit(text) from public;
grant execute on function public.mc_droit(text) to authenticated;

-- Online course resources are stored in public.documents. This restrictive
-- policy combines with the existing centre/course policies and prevents
-- direct PostgREST access when the module is not included in the centre rights.
alter table public.documents enable row level security;
drop policy if exists documents_require_online_course_module on public.documents;
create policy documents_require_online_course_module
  on public.documents
  as restrictive
  for all
  to authenticated
  using (public.mc_droit('cours_en_ligne'))
  with check (public.mc_droit('cours_en_ligne'));

-- Finance tables already have centre/role policies. These additional
-- restrictive policies also require the centre's explicit finance entitlement.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_student_charges',
    'finance_payments',
    'finance_expenses',
    'finance_accounts',
    'finance_account_movements',
    'finance_teacher_payroll'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_require_finance_module',
      table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.mc_droit(''gestion_financiere'')) with check (public.mc_droit(''gestion_financiere''))',
      table_name || '_require_finance_module',
      table_name
    );
  end loop;
end $$;
