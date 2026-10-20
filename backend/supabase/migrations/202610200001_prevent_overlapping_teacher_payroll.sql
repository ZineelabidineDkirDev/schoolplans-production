-- Prevent duplicate/overlapping payroll periods for the same teacher.
-- Deploy this migration before using the updated payroll UI.
-- Existing rows are preserved; overlapping draft payrolls can still be cancelled.

create or replace function public.finance_prevent_overlapping_teacher_payroll()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from 'cancelled' and exists (
    select 1
    from public.finance_teacher_payroll existing
    where existing.centre_id = new.centre_id
      and existing.teacher_id = new.teacher_id
      and existing.id <> new.id
      and existing.status <> 'cancelled'
      and existing.period_start <= new.period_end
      and existing.period_end >= new.period_start
  ) then
    raise exception
      'Période de rémunération chevauchante : ce formateur possède déjà une paie non annulée sur tout ou partie de ces dates. Annulez le brouillon en doublon ou choisissez une période sans chevauchement.';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_teacher_payroll_no_overlap
  on public.finance_teacher_payroll;

create trigger finance_teacher_payroll_no_overlap
before insert or update of centre_id, teacher_id, period_start, period_end, status
on public.finance_teacher_payroll
for each row
execute function public.finance_prevent_overlapping_teacher_payroll();
