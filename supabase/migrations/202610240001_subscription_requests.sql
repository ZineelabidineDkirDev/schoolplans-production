create extension if not exists pgcrypto;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null check (length(trim(contact_name)) between 2 and 100),
  centre_name text not null check (length(trim(centre_name)) between 2 and 150),
  email text not null check (length(trim(email)) between 3 and 254),
  phone text not null check (length(trim(phone)) between 6 and 30),
  plan text not null check (plan in ('STARTER', 'STANDARD', 'PROFESSIONAL')),
  annual_price_mad integer not null check (
    (plan = 'STARTER' and annual_price_mad = 1490) or
    (plan = 'STANDARD' and annual_price_mad = 2990) or
    (plan = 'PROFESSIONAL' and annual_price_mad = 5990)
  ),
  status text not null default 'pending' check (status in ('pending', 'contacted', 'paid', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_notes text
);

create index if not exists subscription_requests_status_created_idx
  on public.subscription_requests (status, created_at desc);

alter table public.subscription_requests enable row level security;

grant insert on public.subscription_requests to anon, authenticated;
grant select, update on public.subscription_requests to authenticated;

drop policy if exists "Public can submit subscription requests" on public.subscription_requests;
create policy "Public can submit subscription requests"
  on public.subscription_requests for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and admin_notes is null
  );

drop policy if exists "Super admins can read subscription requests" on public.subscription_requests;
create policy "Super admins can read subscription requests"
  on public.subscription_requests for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ));

drop policy if exists "Super admins can update subscription requests" on public.subscription_requests;
create policy "Super admins can update subscription requests"
  on public.subscription_requests for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ));
