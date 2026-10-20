-- Online course resources v1: files and external video/resource links.
-- Apply after the finance migrations on branch fix/react-root-routing.

alter table public.documents
  add column if not exists resource_type text not null default 'file',
  add column if not exists external_url text,
  add column if not exists sort_order integer not null default 0;

-- Link resources do not have an object in Supabase Storage.
alter table public.documents
  alter column fichier_path drop not null;

update public.documents
set resource_type = 'file'
where resource_type is null;

with ranked as (
  select id,
         row_number() over (
           partition by centre_id, cours_id
           order by created_at, id
         )::integer as position
  from public.documents
)
update public.documents d
set sort_order = ranked.position
from ranked
where ranked.id = d.id;

alter table public.documents
  drop constraint if exists documents_resource_type_check,
  add constraint documents_resource_type_check
    check (resource_type in ('file', 'link')),
  drop constraint if exists documents_resource_target_check,
  add constraint documents_resource_target_check
    check (
      (resource_type = 'file' and external_url is null)
      or
      (resource_type = 'link'
        and fichier_path is null
        and external_url is not null
        and external_url ~* '^https?://')
    );

-- Teachers may edit/reorder resources only for courses assigned to their own
-- teacher profile and centre. Existing read/insert/delete policies remain in place.
alter table public.documents enable row level security;
grant update on public.documents to authenticated;

drop policy if exists documents_teacher_update_own_course on public.documents;
create policy documents_teacher_update_own_course
  on public.documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.formateurs f
        on f.profile_id = p.id
       and f.centre_id = p.centre_id
      join public.cours c
        on c.formateur_id = f.id
       and c.centre_id = f.centre_id
       and c.id = documents.cours_id
      where p.id = auth.uid()
        and p.role = 'formateur'
        and p.centre_id = documents.centre_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      join public.formateurs f
        on f.profile_id = p.id
       and f.centre_id = p.centre_id
      join public.cours c
        on c.formateur_id = f.id
       and c.centre_id = f.centre_id
       and c.id = documents.cours_id
      where p.id = auth.uid()
        and p.role = 'formateur'
        and p.centre_id = documents.centre_id
    )
  );

-- Explicitly allow a teacher to add a URL resource without a Storage object,
-- while retaining strict centre and assigned-course checks.
drop policy if exists documents_teacher_insert_link_own_course on public.documents;
create policy documents_teacher_insert_link_own_course
  on public.documents
  for insert
  to authenticated
  with check (
    resource_type = 'link'
    and fichier_path is null
    and external_url is not null
    and external_url ~* '^https?://'
    and exists (
      select 1
      from public.profiles p
      join public.formateurs f
        on f.profile_id = p.id
       and f.centre_id = p.centre_id
      join public.cours c
        on c.formateur_id = f.id
       and c.centre_id = f.centre_id
       and c.id = documents.cours_id
      where p.id = auth.uid()
        and p.role = 'formateur'
        and p.centre_id = documents.centre_id
    )
  );
