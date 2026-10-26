-- Keep reviewed demo requests for audit while hiding them from the active list.
alter table public.demo_requests
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists demo_requests_active_status_created_idx
  on public.demo_requests (status, created_at desc)
  where archived_at is null;
