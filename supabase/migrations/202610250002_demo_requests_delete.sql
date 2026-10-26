-- Allow only Super Admins to permanently remove demo requests.
grant delete on public.demo_requests to authenticated;

drop policy if exists "Super admins can delete demo requests" on public.demo_requests;
create policy "Super admins can delete demo requests"
  on public.demo_requests for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ));
