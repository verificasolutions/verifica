do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'attendance_media_kind'
  ) then
    create type public.attendance_media_kind as enum ('entry', 'step', 'ready', 'damage_note', 'marketing');
  end if;
end
$$;

create table if not exists public.attendance_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  box_id uuid references public.operation_boxes (id) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  kind public.attendance_media_kind not null,
  file_path text not null,
  mime_type text not null,
  caption text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendance_media_attendance_idx
on public.attendance_media (attendance_id, created_at desc);

alter table public.attendance_media enable row level security;
grant select, insert on public.attendance_media to authenticated;

drop policy if exists "tenant users can read attendance media" on public.attendance_media;
create policy "tenant users can read attendance media"
on public.attendance_media
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert attendance media" on public.attendance_media;
create policy "owners managers can insert attendance media"
on public.attendance_media
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "operators can insert own attendance media" on public.attendance_media;
create policy "operators can insert own attendance media"
on public.attendance_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and a.tenant_id = tenant_id
      and public.current_tenant_role(a.tenant_id) = 'operator'
      and a.employee_id = public.current_employee_id(a.tenant_id)
  )
);
