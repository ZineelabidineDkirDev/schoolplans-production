-- Finance hardening v6.
-- Apply after 202610200001_prevent_overlapping_teacher_payroll.sql.
-- Keeps the financial ledger append-only for authenticated users and routes writes
-- through validated atomic RPCs. Existing records are not changed or deleted.

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

-- These routines perform their own role, centre, status and balance checks.
-- SECURITY DEFINER lets them write safely after direct table writes are revoked.
alter function public.finance_record_student_payment(uuid, numeric, text, text, uuid, text, text) security definer;
alter function public.finance_pay_teacher_payroll(uuid, uuid) security definer;
alter function public.finance_record_teacher_advance(bigint, numeric, date, uuid, text) security definer;
alter function public.finance_pay_expense(uuid, uuid) security definer;
alter function public.finance_transfer_accounts(uuid, uuid, numeric, timestamptz) security definer;
alter function public.finance_save_teacher_payroll(uuid, bigint, date, date, text, numeric, numeric, numeric, numeric, numeric, numeric, text) security definer;
alter function public.finance_change_teacher_payroll_status(uuid, text) security definer;

revoke all on function public.finance_record_manual_movement(uuid, text, numeric, timestamptz, text) from public;
grant execute on function public.finance_record_manual_movement(uuid, text, numeric, timestamptz, text) to authenticated;

-- Prevent client-side writes from bypassing the atomic RPC validation.
revoke insert, update on public.finance_payments from authenticated;
revoke insert, update on public.finance_account_movements from authenticated;
revoke insert, update on public.finance_teacher_advances from authenticated;
revoke insert, update on public.finance_teacher_advance_repayments from authenticated;
revoke insert, update on public.finance_teacher_payroll from authenticated;

-- A payroll may only deduct advances that had actually been issued by its
-- period end. The existing atomic save RPC separately checks the outstanding
-- (not already reserved/recovered) balance.
create or replace function public.finance_validate_payroll_advance_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eligible_advances numeric(12,2);
begin
  select coalesce(sum(a.amount), 0)
    into v_eligible_advances
  from public.finance_teacher_advances a
  where a.centre_id = new.centre_id
    and a.teacher_id = new.teacher_id
    and a.status = 'active'
    and a.advance_date <= new.period_end;

  if round(coalesce(new.advance_deduction, 0), 2) > round(v_eligible_advances, 2) then
    raise exception
      'Déduction impossible : les avances émises au plus tard le % totalisent % DH.',
      new.period_end, round(v_eligible_advances, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists finance_payroll_advance_date_guard
  on public.finance_teacher_payroll;

create trigger finance_payroll_advance_date_guard
before insert or update of teacher_id, period_end, advance_deduction
on public.finance_teacher_payroll
for each row
execute function public.finance_validate_payroll_advance_date();

revoke all on function public.finance_validate_payroll_advance_date() from public;

-- Do not hide money by deactivating a cash/bank account that still has a balance.
create or replace function public.finance_prevent_deactivate_nonzero_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric(12,2);
begin
  if old.active = true and new.active = false then
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
    where a.id = old.id and a.centre_id = old.centre_id
    group by a.id, a.opening_balance;

    if round(coalesce(v_balance, 0), 2) <> 0 then
      raise exception
        'Impossible de désactiver ce compte : son solde est de % DH. Transférez d’abord les fonds.',
        round(v_balance, 2);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists finance_account_no_deactivate_with_balance
  on public.finance_accounts;

create trigger finance_account_no_deactivate_with_balance
before update of active on public.finance_accounts
for each row
execute function public.finance_prevent_deactivate_nonzero_account();

revoke all on function public.finance_prevent_deactivate_nonzero_account() from public;
