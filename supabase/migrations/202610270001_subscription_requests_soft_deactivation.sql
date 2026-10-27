-- Add soft-archive metadata to subscription requests; retain rows for audit.
alter table public.subscription_requests add column if not exists archived_at timestamptz;
alter table public.subscription_requests add column if not exists archived_by uuid references auth.users(id) on delete set null;
create index if not exists subscription_requests_active_status_created_idx on public.subscription_requests (status, created_at desc) where archived_at is null;
