do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'operation_box_kind'
  ) then
    create type public.operation_box_kind as enum ('entry', 'wash', 'dry', 'finish', 'ready');
  end if;
end
$$;

create table if not exists public.operation_boxes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null,
  kind public.operation_box_kind not null,
  sort_order integer not null default 0,
  sla_minutes integer,
  color_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists operation_boxes_tenant_code_idx
on public.operation_boxes (tenant_id, code);

create index if not exists operation_boxes_tenant_sort_idx
on public.operation_boxes (tenant_id, sort_order);

drop trigger if exists set_operation_boxes_updated_at on public.operation_boxes;
create trigger set_operation_boxes_updated_at
before update on public.operation_boxes
for each row execute function public.set_updated_at();

create table if not exists public.attendance_box_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  from_box_id uuid references public.operation_boxes (id) on delete set null,
  to_box_id uuid references public.operation_boxes (id) on delete set null,
  moved_by uuid references auth.users (id) on delete set null,
  moved_at timestamptz not null default timezone('utc', now()),
  note text
);

create index if not exists attendance_box_events_attendance_idx
on public.attendance_box_events (attendance_id, moved_at desc);

alter table public.attendances
  add column if not exists current_box_id uuid references public.operation_boxes (id) on delete set null,
  add column if not exists queue_position integer,
  add column if not exists operational_stage text not null default 'queue';

alter table public.tenant_settings
  add column if not exists operations_mode text not null default 'boxes',
  add column if not exists tv_mode_enabled boolean not null default false,
  add column if not exists require_ready_photo boolean not null default false,
  add column if not exists allow_step_photos boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_settings_operations_mode_check'
  ) then
    alter table public.tenant_settings
      add constraint tenant_settings_operations_mode_check
      check (operations_mode in ('classic', 'boxes'));
  end if;
end
$$;

alter table public.operation_boxes enable row level security;
alter table public.attendance_box_events enable row level security;

grant select, insert, update on public.operation_boxes to authenticated;
grant select on public.attendance_box_events to authenticated;

drop policy if exists "tenant users can read operation boxes" on public.operation_boxes;
create policy "tenant users can read operation boxes"
on public.operation_boxes
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert operation boxes" on public.operation_boxes;
create policy "owners managers can insert operation boxes"
on public.operation_boxes
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update operation boxes" on public.operation_boxes;
create policy "owners managers can update operation boxes"
on public.operation_boxes
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read attendance box events" on public.attendance_box_events;
create policy "tenant users can read attendance box events"
on public.attendance_box_events
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create or replace function public.move_attendance_to_box_atomic(
  p_attendance_id uuid,
  p_box_id uuid,
  p_queue_position integer default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance public.attendances%rowtype;
  v_box public.operation_boxes%rowtype;
  v_actor_employee_id uuid;
  v_new_status public.attendance_status;
begin
  select *
  into v_attendance
  from public.attendances
  where id = p_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento nao encontrado.';
  end if;

  select *
  into v_box
  from public.operation_boxes
  where id = p_box_id
    and is_active = true;

  if v_box.id is null then
    raise exception 'Box operacional nao encontrado.';
  end if;

  if v_box.tenant_id <> v_attendance.tenant_id then
    raise exception 'Box invalido para este tenant.';
  end if;

  v_actor_employee_id := public.current_employee_id(v_attendance.tenant_id);

  if not public.is_tenant_owner_or_manager(v_attendance.tenant_id) then
    if public.current_tenant_role(v_attendance.tenant_id) <> 'operator'
      or v_actor_employee_id is null
      or v_attendance.employee_id <> v_actor_employee_id then
      raise exception 'Acesso negado.';
    end if;
  end if;

  v_new_status := case
    when v_box.kind = 'entry' then 'waiting'::public.attendance_status
    when v_box.kind = 'wash' then 'washing'::public.attendance_status
    when v_box.kind in ('dry', 'finish') then 'finishing'::public.attendance_status
    when v_box.kind = 'ready' then 'ready'::public.attendance_status
    else v_attendance.status
  end;

  update public.attendances
  set current_box_id = v_box.id,
      queue_position = p_queue_position,
      operational_stage = v_box.kind::text,
      status = v_new_status,
      started_at = case
        when v_new_status = 'washing' then coalesce(started_at, timezone('utc', now()))
        else started_at
      end,
      ready_at = case
        when v_new_status = 'ready' then coalesce(ready_at, timezone('utc', now()))
        else ready_at
      end
  where id = v_attendance.id;

  insert into public.attendance_box_events (
    tenant_id,
    attendance_id,
    from_box_id,
    to_box_id,
    moved_by,
    note
  ) values (
    v_attendance.tenant_id,
    v_attendance.id,
    v_attendance.current_box_id,
    v_box.id,
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  );

  update public.attendance_public_status
  set status = v_new_status,
      eta_minutes = case
        when v_new_status = 'ready' then 0
        else greatest(coalesce(v_attendance.estimated_minutes, 0) + coalesce(v_attendance.extra_minutes, 0), 0)
      end
  where attendance_id = v_attendance.id;
end;
$$;
