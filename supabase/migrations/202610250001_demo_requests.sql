create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null check (length(trim(contact_name)) between 2 and 100),
  centre_name text not null check (length(trim(centre_name)) between 2 and 150),
  email text not null check (length(trim(email)) between 3 and 254),
  phone text not null check (length(trim(phone)) between 6 and 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  demo_started_at timestamptz,
  demo_expires_at timestamptz,
  admin_notes text,
  constraint demo_dates_valid check (
    (status <> 'approved' and demo_started_at is null and demo_expires_at is null)
    or
    (status = 'approved' and demo_started_at is not null and demo_expires_at = demo_started_at + interval '14 days')
  )
);

create index if not exists demo_requests_status_created_idx
  on public.demo_requests (status, created_at desc);

alter table public.demo_requests enable row level security;

grant insert on public.demo_requests to anon, authenticated;
grant select, update on public.demo_requests to authenticated;

drop policy if exists "Public can submit demo requests" on public.demo_requests;
create policy "Public can submit demo requests"
  on public.demo_requests for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and demo_started_at is null
    and demo_expires_at is null
    and admin_notes is null
  );

drop policy if exists "Super admins can read demo requests" on public.demo_requests;
create policy "Super admins can read demo requests"
  on public.demo_requests for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ));

drop policy if exists "Super admins can update demo requests" on public.demo_requests;
create policy "Super admins can update demo requests"
  on public.demo_requests for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ));
