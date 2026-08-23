alter table public.customers
  add column if not exists is_fleet boolean not null default false;

create index if not exists customers_tenant_is_fleet_idx
  on public.customers (tenant_id, is_fleet)
  where is_active = true;
