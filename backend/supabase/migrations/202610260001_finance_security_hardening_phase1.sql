-- SchoolPlans finance security hardening (phase 1)
-- Branch: fix/finance-security-hardening
-- Adds fail-closed module-right RLS coverage to every finance table present
-- in this schema, including advances, repayments, rates and payroll adjustments.
-- Does not modify or delete existing financial records.

do $$
declare
  v_table text;
  v_tables text[] := array[
    'finance_student_charges',
    'finance_payments',
    'finance_expenses',
    'finance_accounts',
    'finance_account_movements',
    'finance_teacher_payroll',
    'finance_teacher_rates',
    'finance_teacher_payroll_adjustments',
    'finance_teacher_advances',
    'finance_teacher_advance_repayments'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);
      execute format('drop policy if exists %I on public.%I',
        v_table || '_require_finance_module', v_table);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.mc_droit(''gestion_financiere'')) with check (public.mc_droit(''gestion_financiere''))',
        v_table || '_require_finance_module', v_table
      );
    end if;
  end loop;
end $$;

-- SECURITY DEFINER bypasses table RLS, so the manual movement RPC must check
-- the module entitlement itself before it performs any financial write.
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
  if auth.uid() is null or not public.mc_droit('gestion_financiere') then
    raise exception 'Accès refusé : le module Gestion financière n’est pas inclus dans le pack du centre.';
  end if;

  select p.centre_id, p.role
    into v_centre_id, v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role, '') not in ('admin', 'director') or v_centre_id is null then
    raise exception 'Accès refusé : directeur ou administrateur du centre requis.';
  end if;

  if p_movement_type is null or p_movement_type not in ('inflow', 'outflow') then
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

revoke all on function public.finance_record_manual_movement(uuid, text, numeric, timestamptz, text) from public;
grant execute on function public.finance_record_manual_movement(uuid, text, numeric, timestamptz, text) to authenticated;
