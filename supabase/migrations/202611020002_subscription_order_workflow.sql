alter table public.subscription_requests
  add column if not exists payment_reference text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists centre_id uuid references public.centres(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscription_requests
  drop constraint if exists subscription_requests_status_check,
  add constraint subscription_requests_status_check
    check (status in (
      'pending',
      'contacted',
      'payment_pending',
      'paid',
      'activated',
      'rejected',
      'cancelled'
    )),
  drop constraint if exists subscription_requests_payment_reference_length_check,
  add constraint subscription_requests_payment_reference_length_check
    check (payment_reference is null or length(trim(payment_reference)) between 2 and 300);

update public.subscription_requests
set payment_verified_at = coalesce(reviewed_at, created_at)
where status = 'paid'
  and payment_verified_at is null;

create index if not exists subscription_requests_centre_id_idx
  on public.subscription_requests (centre_id)
  where centre_id is not null;

create or replace function public.touch_subscription_request_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscription_requests_touch_updated_at
  on public.subscription_requests;
create trigger subscription_requests_touch_updated_at
before update on public.subscription_requests
for each row
execute function public.touch_subscription_request_updated_at();

revoke all on function public.touch_subscription_request_updated_at() from public;

drop policy if exists "Public can submit subscription requests"
  on public.subscription_requests;
create policy "Public can submit subscription requests"
  on public.subscription_requests for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and admin_notes is null
    and payment_reference is null
    and payment_verified_at is null
    and activated_at is null
    and centre_id is null
  );
