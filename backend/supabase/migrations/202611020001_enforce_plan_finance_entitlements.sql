-- Enforce the published plan entitlements in the database, not only in the UI.
-- Unknown/legacy plans continue to use their explicitly stored rights.

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
  v_pack text;
  v_expiration timestamptz;
  v_is_demo boolean;
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
    'seances', 'formations', 'groupes', 'cours_en_ligne',
    'gestion_financiere', 'notes_bulletins'
  ) then
    return false;
  end if;

  if v_role not in ('admin', 'director', 'formateur', 'etudiant')
     or v_centre_id is null then
    return false;
  end if;

  select c.droits::jsonb,
         c.type_abonnement,
         c.date_expiration::timestamptz
    into v_droits, v_pack, v_expiration
  from public.centres c
  where c.id = v_centre_id
    and c.actif = true
  limit 1;

  if v_droits is null then
    return false;
  end if;

  v_is_demo := coalesce((v_droits ->> 'demo_14_jours')::boolean, false);

  if v_is_demo and (v_expiration is null or v_expiration <= now()) then
    return false;
  end if;

  if v_is_demo and p_droit = 'gestion_financiere' then
    return false;
  end if;

  if not v_is_demo then
    case upper(trim(coalesce(v_pack, '')))
      when 'STARTER' then
        if p_droit not in (
          'etudiants', 'formateurs', 'cours', 'planning', 'salles',
          'import_excel', 'export_excel', 'formations', 'groupes'
        ) then
          return false;
        end if;
      when 'STANDARD' then
        if p_droit not in (
          'etudiants', 'formateurs', 'cours', 'planning', 'salles',
          'import_excel', 'export_excel', 'formations', 'groupes',
          'presences', 'certificats', 'supports', 'documents', 'seances'
        ) then
          return false;
        end if;
      when 'PROFESSIONAL' then
        if p_droit not in (
          'etudiants', 'formateurs', 'cours', 'planning', 'salles',
          'import_excel', 'export_excel', 'formations', 'groupes',
          'presences', 'certificats', 'supports', 'documents', 'seances',
          'statistiques', 'rapports', 'cours_en_ligne', 'gestion_financiere'
        ) then
          return false;
        end if;
    end case;
  end if;

  return coalesce((v_droits ->> p_droit)::boolean, false);
end;
$$;

revoke all on function public.mc_droit(text) from public;
grant execute on function public.mc_droit(text) to authenticated;

-- Protect direct reads of advance records, which were added after the original
-- set of finance-module RLS policies.
alter table public.finance_teacher_advances enable row level security;
drop policy if exists finance_teacher_advances_require_finance_module
  on public.finance_teacher_advances;
create policy finance_teacher_advances_require_finance_module
  on public.finance_teacher_advances
  as restrictive
  for all
  to authenticated
  using (public.mc_droit('gestion_financiere'))
  with check (public.mc_droit('gestion_financiere'));

alter table public.finance_teacher_advance_repayments enable row level security;
drop policy if exists finance_teacher_advance_repayments_require_finance_module
  on public.finance_teacher_advance_repayments;
create policy finance_teacher_advance_repayments_require_finance_module
  on public.finance_teacher_advance_repayments
  as restrictive
  for all
  to authenticated
  using (public.mc_droit('gestion_financiere'))
  with check (public.mc_droit('gestion_financiere'));

-- SECURITY DEFINER finance RPCs bypass RLS, so guard writes at the table boundary too.
create or replace function public.finance_require_module_entitlement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.mc_droit('gestion_financiere') then
    raise exception 'Accès refusé : le module Gestion financière n’est pas inclus dans le pack du centre.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.finance_require_module_entitlement() from public;

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
    'finance_teacher_payroll',
    'finance_teacher_advances',
    'finance_teacher_advance_repayments'
  ]
  loop
    execute format(
      'drop trigger if exists finance_require_module_entitlement on public.%I',
      table_name
    );
    execute format(
      'create trigger finance_require_module_entitlement before insert or update or delete on public.%I for each row execute function public.finance_require_module_entitlement()',
      table_name
    );
  end loop;
end $$;
