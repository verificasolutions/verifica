create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  service_id uuid not null references public.services (id) on delete restrict,
  request_description text not null,
  labor_description text,
  labor_amount numeric(12, 2) not null default 0,
  parts_description text,
  parts_amount numeric(12, 2) not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  approved_attendance_id uuid references public.attendances (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists service_quotes_tenant_customer_idx
on public.service_quotes (tenant_id, customer_id, created_at desc);

create index if not exists service_quotes_tenant_status_idx
on public.service_quotes (tenant_id, status, created_at desc);

drop trigger if exists set_service_quotes_updated_at on public.service_quotes;
create trigger set_service_quotes_updated_at
before update on public.service_quotes
for each row execute function public.set_updated_at();

alter table public.service_quotes enable row level security;

grant select, insert, update on public.service_quotes to authenticated;

drop policy if exists "tenant users can read service quotes" on public.service_quotes;
create policy "tenant users can read service quotes"
on public.service_quotes
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage service quotes" on public.service_quotes;
create policy "owners managers can manage service quotes"
on public.service_quotes
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
