create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  default_service_minutes integer not null default 30,
  queue_entry_message text,
  wash_start_message text,
  ready_message text,
  return_reminder_message text,
  evolution_base_url text,
  evolution_instance text,
  evolution_api_key text,
  evolution_enabled boolean not null default false,
  operator_can_edit_status boolean not null default true,
  operator_can_view_all_cars boolean not null default true,
  operator_can_view_customer_phone boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_tenant_settings_updated_at
before update on public.tenant_settings
for each row execute function public.set_updated_at();

alter table public.tenant_settings enable row level security;

grant select, insert, update on public.tenant_settings to authenticated;

create or replace function public.current_tenant_role(target_tenant_id uuid)
returns public.app_role
language sql
stable
as $$
  select tu.role
  from public.tenant_users tu
  where tu.tenant_id = target_tenant_id
    and tu.user_id = auth.uid()
    and tu.is_active = true
  limit 1;
$$;

create or replace function public.is_tenant_owner_or_manager(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(public.current_tenant_role(target_tenant_id) in ('owner', 'manager'), false);
$$;

create or replace function public.current_employee_id(target_tenant_id uuid)
returns uuid
language sql
stable
as $$
  select e.id
  from public.employees e
  where e.tenant_id = target_tenant_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1;
$$;

drop policy if exists "tenant users can update employees" on public.employees;
drop policy if exists "tenant users can update appointments" on public.appointments;
drop policy if exists "tenant users can update attendances" on public.attendances;
drop policy if exists "tenant users can update public tracking status" on public.attendance_public_status;
drop policy if exists "tenant users can update cash sessions" on public.cash_sessions;
drop policy if exists "tenant users can update cash entries" on public.cash_entries;
drop policy if exists "tenant users can update services" on public.services;
drop policy if exists "tenant users can update customers" on public.customers;
drop policy if exists "tenant users can update vehicles" on public.vehicles;

create policy "owners managers can update employees"
on public.employees
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update appointments"
on public.appointments
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update services"
on public.services
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update customers"
on public.customers
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update vehicles"
on public.vehicles
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update cash sessions"
on public.cash_sessions
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update cash entries"
on public.cash_entries
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update attendances"
on public.attendances
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "operators can update own attendances"
on public.attendances
for update
to authenticated
using (
  public.current_tenant_role(tenant_id) = 'operator'
  and employee_id = public.current_employee_id(tenant_id)
)
with check (
  public.current_tenant_role(tenant_id) = 'operator'
  and employee_id = public.current_employee_id(tenant_id)
);

create policy "owners managers can update public tracking"
on public.attendance_public_status
for update
to authenticated
using (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_owner_or_manager(a.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_owner_or_manager(a.tenant_id)
  )
);

create policy "operators can update own public tracking"
on public.attendance_public_status
for update
to authenticated
using (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.current_tenant_role(a.tenant_id) = 'operator'
      and a.employee_id = public.current_employee_id(a.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.current_tenant_role(a.tenant_id) = 'operator'
      and a.employee_id = public.current_employee_id(a.tenant_id)
  )
);

create policy "tenant users can read tenant settings"
on public.tenant_settings
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "owners managers can insert tenant settings"
on public.tenant_settings
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update tenant settings"
on public.tenant_settings
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
