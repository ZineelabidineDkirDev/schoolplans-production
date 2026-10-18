-- SchoolPlans Finance v4: atomically reconcile student receipts and teacher payroll with treasury.
-- Apply after 202610180003_teacher_payroll_modes_and_advances.sql.
-- All operations are restricted to the authenticated admin/director's own centre.

create or replace function public.finance_record_student_payment(
  p_charge_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_receipt_number text,
  p_account_id uuid,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_centre_id uuid;
  v_profile_centre_id uuid;
  v_role text;
  v_amount_due numeric(12,2);
  v_charge_status text;
  v_paid numeric(12,2);
  v_account_id uuid;
  v_payment_id uuid := gen_random_uuid();
begin
  select p.centre_id, p.role
    into v_profile_centre_id, v_role
  from public.profiles p
  where p.id = auth.uid();

  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'director') or v_profile_centre_id is null then
    raise exception 'Accès refusé : directeur ou administrateur du centre requis.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement doit être supérieur à zéro.';
  end if;
  if nullif(trim(p_receipt_number), '') is null then
    raise exception 'Le numéro du reçu est obligatoire.';
  end if;
  if p_payment_method not in ('cash', 'bank_transfer', 'card', 'cheque', 'other') then
    raise exception 'Mode de paiement invalide.';
  end if;

  select c.centre_id, c.amount_due, c.status
    into v_centre_id, v_amount_due, v_charge_status
  from public.finance_student_charges c
  where c.id = p_charge_id
  for update;

  if not found or v_centre_id <> v_profile_centre_id then
    raise exception 'Frais introuvables pour ce centre.';
  end if;
  if v_charge_status = 'cancelled' then
    raise exception 'Impossible d’enregistrer un paiement sur des frais annulés.';
  end if;

  select coalesce(sum(p.amount), 0)
    into v_paid
  from public.finance_payments p
  where p.centre_id = v_centre_id and p.charge_id = p_charge_id;

  if round(v_paid + p_amount, 2) > v_amount_due then
    raise exception 'Le paiement dépasse le reste dû : % DH.', round(greatest(v_amount_due - v_paid, 0), 2);
  end if;

  select a.id into v_account_id
  from public.finance_accounts a
  where a.id = p_account_id
    and a.centre_id = v_centre_id
    and a.active = true
  for update;

  if not found then
    raise exception 'La caisse ou le compte bancaire est introuvable ou inactif.';
  end if;

  insert into public.finance_payments (
    id, centre_id, charge_id, amount, payment_method, receipt_number,
    reference, notes, created_by
  ) values (
    v_payment_id, v_centre_id, p_charge_id, round(p_amount, 2), p_payment_method,
    trim(p_receipt_number), nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid()
  );

  update public.finance_student_charges
  set status = case
        when round(v_paid + p_amount, 2) >= v_amount_due then 'paid'
        else 'partial'
      end,
      updated_at = now()
  where id = p_charge_id and centre_id = v_centre_id;

  insert into public.finance_account_movements (
    centre_id, account_id, movement_type, amount, movement_date,
    description, source_type, source_id, created_by
  ) values (
    v_centre_id, v_account_id, 'inflow', round(p_amount, 2), now(),
    'Paiement étudiant — reçu ' || trim(p_receipt_number), 'student_payment', v_payment_id, auth.uid()
  );

  return v_payment_id;
end;
$$;

create or replace function public.finance_pay_teacher_payroll(
  p_payroll_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_centre_id uuid;
  v_profile_centre_id uuid;
  v_role text;
  v_teacher_id bigint;
  v_amount numeric(12,2);
  v_status text;
  v_teacher_name text;
  v_account_id uuid;
  v_balance numeric(12,2);
begin
  select p.centre_id, p.role
    into v_profile_centre_id, v_role
  from public.profiles p
  where p.id = auth.uid();

  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'director') or v_profile_centre_id is null then
    raise exception 'Accès refusé : directeur ou administrateur du centre requis.';
  end if;

  select pr.centre_id, pr.teacher_id, pr.amount_due, pr.status
    into v_centre_id, v_teacher_id, v_amount, v_status
  from public.finance_teacher_payroll pr
  where pr.id = p_payroll_id
  for update;

  if not found or v_centre_id <> v_profile_centre_id then
    raise exception 'Rémunération introuvable pour ce centre.';
  end if;
  if v_status <> 'approved' then
    raise exception 'Seule une rémunération validée et non payée peut être réglée.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Le montant net de la rémunération doit être supérieur à zéro pour effectuer le règlement.';
  end if;

  select a.id into v_account_id
  from public.finance_accounts a
  where a.id = p_account_id and a.centre_id = v_centre_id and a.active = true
  for update;

  if not found then
    raise exception 'La caisse ou le compte bancaire est introuvable ou inactif.';
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
  where a.id = v_account_id and a.centre_id = v_centre_id
  group by a.id, a.opening_balance;

  if v_balance < v_amount then
    raise exception 'Solde insuffisant : disponible % DH, rémunération % DH.', round(v_balance, 2), round(v_amount, 2);
  end if;

  select f.nom into v_teacher_name
  from public.formateurs f
  where f.id = v_teacher_id and f.centre_id = v_centre_id;

  insert into public.finance_account_movements (
    centre_id, account_id, movement_type, amount, movement_date,
    description, source_type, source_id, created_by
  ) values (
    v_centre_id, v_account_id, 'outflow', v_amount, now(),
    'Rémunération formateur : ' || coalesce(v_teacher_name, 'Formateur') || ' (' || p_payroll_id::text || ')',
    'teacher_payroll', p_payroll_id, auth.uid()
  );

  update public.finance_teacher_payroll
  set status = 'paid', paid_at = now()
  where id = p_payroll_id and centre_id = v_centre_id and status = 'approved';
end;
$$;

revoke all on function public.finance_record_student_payment(uuid, numeric, text, text, uuid, text, text) from public;
revoke all on function public.finance_pay_teacher_payroll(uuid, uuid) from public;
grant execute on function public.finance_record_student_payment(uuid, numeric, text, text, uuid, text, text) to authenticated;
grant execute on function public.finance_pay_teacher_payroll(uuid, uuid) to authenticated;


create or replace function public.finance_record_teacher_advance(
  p_teacher_id bigint,
  p_amount numeric,
  p_advance_date date,
  p_account_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_centre_id uuid;
  v_profile_centre_id uuid;
  v_role text;
  v_teacher_name text;
  v_account_name text;
  v_account_id uuid;
  v_balance numeric(12,2);
  v_advance_id uuid := gen_random_uuid();
begin
  select p.centre_id, p.role
    into v_profile_centre_id, v_role
  from public.profiles p
  where p.id = auth.uid();

  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'director') or v_profile_centre_id is null then
    raise exception 'Accès refusé : directeur ou administrateur du centre requis.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant de l’avance doit être supérieur à zéro.';
  end if;
  if p_advance_date is null then
    raise exception 'La date de l’avance est obligatoire.';
  end if;

  select f.nom into v_teacher_name
  from public.formateurs f
  where f.id = p_teacher_id and f.centre_id = v_profile_centre_id;

  if not found then
    raise exception 'Formateur introuvable pour ce centre.';
  end if;

  select a.id, a.name into v_account_id, v_account_name
  from public.finance_accounts a
  where a.id = p_account_id and a.centre_id = v_profile_centre_id and a.active = true
  for update;

  if not found then
    raise exception 'La caisse ou le compte bancaire est introuvable ou inactif.';
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
  where a.id = v_account_id and a.centre_id = v_profile_centre_id
  group by a.id, a.opening_balance;

  if v_balance < p_amount then
    raise exception 'Solde insuffisant dans « % » : disponible % DH.', v_account_name, round(v_balance, 2);
  end if;

  insert into public.finance_teacher_advances (
    id, centre_id, teacher_id, amount, advance_date, notes, status, created_by
  ) values (
    v_advance_id, v_profile_centre_id, p_teacher_id, round(p_amount, 2),
    p_advance_date, nullif(trim(p_notes), ''), 'active', auth.uid()
  );

  insert into public.finance_account_movements (
    centre_id, account_id, movement_type, amount, movement_date,
    description, source_type, source_id, created_by
  ) values (
    v_profile_centre_id, v_account_id, 'outflow', round(p_amount, 2),
    p_advance_date::timestamptz,
    'Avance formateur : ' || coalesce(v_teacher_name, 'Formateur'),
    'teacher_advance', v_advance_id, auth.uid()
  );

  return v_advance_id;
end;
$$;

revoke all on function public.finance_record_teacher_advance(bigint, numeric, date, uuid, text) from public;
grant execute on function public.finance_record_teacher_advance(bigint, numeric, date, uuid, text) to authenticated;
