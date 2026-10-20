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

-- SECURITY DEFINER finance RPC must check the module explicitly because it bypasses table RLS.
create or replace function public.finance_record_manual_movement(
  p_account_id uuid,
  p_movement_type text,
  p_amount numeric,
  p_movement_date timestamptz,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_centre_id uuid;
  v_role text;
  v_account_name text;
  v_balance numeric(12,2);
  v_amount numeric(12,2);
  v_movement_id uuid := gen_random_uuid();
begin
  if not public.mc_droit('gestion_financiere') then
    raise exception 'Accès refusé : le module Gestion financière n’est pas inclus dans le pack du centre.';
  end if;

  select p.centre_id, p.role
    into v_centre_id, v_role
  from public.profiles p
  where p.id = auth.uid();

  if auth.uid() is null
     or coalesce(v_role, '') not in ('admin', 'director')
     or v_centre_id is null then
    raise exception 'Accès refusé : directeur ou administrateur du centre requis.';
  end if;

  if p_movement_type not in ('inflow', 'outflow') then
    raise exception 'Type de mouvement manuel invalide.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant doit être supérieur à zéro.';
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'Le montant doit être d’au moins 0,01 DH.';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'La description du mouvement est obligatoire.';
  end if;

  select a.name
    into v_account_name
  from public.finance_accounts a
  where a.id = p_account_id
    and a.centre_id = v_centre_id
    and a.active = true
  for update;

  if not found then
    raise exception 'Compte introuvable ou inactif pour ce centre.';
  end if;

  select a.opening_balance + coalesce(sum(
    case
      when m.movement_type in ('inflow', 'transfer_in', 'adjustment') then m.amount
      else -m.amount
    end
  ), 0)
    into v_balance
  from public.finance_accounts a
  left join public.finance_account_movements m
    on m.account_id = a.id and m.centre_id = a.centre_id
  where a.id = p_account_id and a.centre_id = v_centre_id
  group by a.id, a.opening_balance;

  if p_movement_type = 'outflow' and v_balance < v_amount then
    raise exception 'Solde insuffisant dans « % » : disponible % DH.',
      v_account_name, round(v_balance, 2);
  end if;

  insert into public.finance_account_movements (
    id, centre_id, account_id, movement_type, amount, movement_date,
    description, source_type, created_by
  ) values (
    v_movement_id, v_centre_id, p_account_id, p_movement_type, v_amount,
    coalesce(p_movement_date, now()), trim(p_description), 'manual', auth.uid()
  );

  return v_movement_id;
end;
$$;
