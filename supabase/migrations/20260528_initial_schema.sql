create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner', 'manager', 'operator');
create type public.employee_payment_type as enum ('daily', 'commission', 'fixed');
create type public.service_kind as enum ('main', 'extra');
create type public.attendance_status as enum ('waiting', 'washing', 'finishing', 'ready', 'delivered', 'canceled');
create type public.payment_method as enum ('cash', 'pix', 'card', 'pending');
create type public.cash_entry_kind as enum ('income', 'expense');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'admin_master',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  whatsapp text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null default 'operator',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id)
);

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = target_tenant_id
      and tu.user_id = auth.uid()
      and tu.is_active = true
  );
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  whatsapp text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  plate text not null,
  model text not null,
  color text,
  vehicle_type text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, plate)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0,
  average_minutes integer not null default 30,
  short_description text,
  kind public.service_kind not null default 'main',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  phone text,
  role_label text not null,
  can_access_system boolean not null default false,
  payment_type public.employee_payment_type not null default 'daily',
  payment_value numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  scheduled_for timestamptz not null,
  notes text,
  status text not null default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  employee_id uuid references public.employees (id) on delete set null,
  status public.attendance_status not null default 'waiting',
  estimated_minutes integer,
  base_price numeric(10, 2) not null default 0,
  final_price numeric(10, 2) not null default 0,
  payment_method public.payment_method not null default 'pending',
  public_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  public_tracking_enabled boolean not null default true,
  notify_customer boolean not null default false,
  notes text,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.attendance_public_status (
  attendance_id uuid primary key references public.attendances (id) on delete cascade,
  public_code text not null unique,
  vehicle_label text not null,
  status public.attendance_status not null,
  eta_minutes integer,
  step_index integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  opened_by uuid references auth.users (id),
  closed_by uuid references auth.users (id),
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  opening_balance numeric(10, 2) not null default 0,
  closing_balance numeric(10, 2),
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  attendance_id uuid references public.attendances (id) on delete set null,
  kind public.cash_entry_kind not null,
  payment_method public.payment_method,
  description text not null,
  amount numeric(10, 2) not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_platform_admins_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create trigger set_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger set_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create trigger set_attendances_updated_at
before update on public.attendances
for each row execute function public.set_updated_at();

create trigger set_attendance_public_status_updated_at
before update on public.attendance_public_status
for each row execute function public.set_updated_at();

create trigger set_cash_sessions_updated_at
before update on public.cash_sessions
for each row execute function public.set_updated_at();

create trigger set_cash_entries_updated_at
before update on public.cash_entries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_users enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.employees enable row level security;
alter table public.appointments enable row level security;
alter table public.attendances enable row level security;
alter table public.attendance_public_status enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_entries enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.tenants to authenticated;
grant select on public.tenant_users to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.vehicles to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update on public.attendances to authenticated;
grant select, insert, update on public.attendance_public_status to authenticated;
grant select, insert, update on public.cash_sessions to authenticated;
grant select, insert, update on public.cash_entries to authenticated;
grant select on public.attendance_public_status to anon;

create policy "profiles are visible to self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles are updated by self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles are inserted by self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "platform admins can read platform admin records"
on public.platform_admins
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
  )
);

create policy "tenant users can read their tenants"
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id));

create policy "tenant users can read membership"
on public.tenant_users
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can read customers"
on public.customers
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert customers"
on public.customers
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update customers"
on public.customers
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read vehicles"
on public.vehicles
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert vehicles"
on public.vehicles
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update vehicles"
on public.vehicles
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read services"
on public.services
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert services"
on public.services
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update services"
on public.services
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read employees"
on public.employees
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert employees"
on public.employees
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update employees"
on public.employees
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read appointments"
on public.appointments
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert appointments"
on public.appointments
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update appointments"
on public.appointments
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read attendances"
on public.attendances
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert attendances"
on public.attendances
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update attendances"
on public.attendances
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read public tracking status"
on public.attendance_public_status
for select
to authenticated
using (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_member(a.tenant_id)
  )
);

create policy "tenant users can insert public tracking status"
on public.attendance_public_status
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_member(a.tenant_id)
  )
);

create policy "tenant users can update public tracking status"
on public.attendance_public_status
for update
to authenticated
using (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_member(a.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_id
      and public.is_tenant_member(a.tenant_id)
  )
);

create policy "anon can read active public tracking status"
on public.attendance_public_status
for select
to anon
using (is_active = true);

create policy "tenant users can read cash sessions"
on public.cash_sessions
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert cash sessions"
on public.cash_sessions
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update cash sessions"
on public.cash_sessions
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can read cash entries"
on public.cash_entries
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant users can insert cash entries"
on public.cash_entries
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "tenant users can update cash entries"
on public.cash_entries
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));
