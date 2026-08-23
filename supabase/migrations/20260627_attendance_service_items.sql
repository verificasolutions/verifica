alter table public.attendances
  alter column service_id drop not null;

alter table public.attendances
  add column if not exists service_label text;

create table if not exists public.attendance_service_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name text not null,
  estimated_minutes integer,
  unit_price numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'canceled')),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendance_service_items_tenant_attendance_idx
on public.attendance_service_items (tenant_id, attendance_id, sort_order);

create unique index if not exists attendance_service_items_primary_unique
on public.attendance_service_items (attendance_id)
where is_primary = true;

drop trigger if exists set_attendance_service_items_updated_at on public.attendance_service_items;
create trigger set_attendance_service_items_updated_at
before update on public.attendance_service_items
for each row execute function public.set_updated_at();

update public.attendances a
set service_label = coalesce(a.service_label, s.name)
from public.services s
where a.service_id = s.id
  and a.service_label is null;

insert into public.attendance_service_items (
  tenant_id,
  attendance_id,
  service_id,
  name,
  estimated_minutes,
  unit_price,
  status,
  sort_order,
  is_primary
)
select
  a.tenant_id,
  a.id,
  a.service_id,
  coalesce(s.name, a.service_label, 'Orçamento / diagnóstico'),
  a.estimated_minutes,
  coalesce(a.final_price, 0),
  case
    when a.status in ('ready', 'delivered') then 'completed'
    when a.status = 'canceled' then 'canceled'
    else 'pending'
  end,
  1,
  true
from public.attendances a
left join public.services s on s.id = a.service_id
where not exists (
  select 1
  from public.attendance_service_items asi
  where asi.attendance_id = a.id
);

alter table public.attendance_service_items enable row level security;

grant select, insert, update on public.attendance_service_items to authenticated;

drop policy if exists "tenant users can read attendance service items" on public.attendance_service_items;
create policy "tenant users can read attendance service items"
on public.attendance_service_items
for select
using (public.is_tenant_member(tenant_id));

drop policy if exists "tenant users can manage attendance service items" on public.attendance_service_items;
create policy "tenant users can manage attendance service items"
on public.attendance_service_items
for all
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));
