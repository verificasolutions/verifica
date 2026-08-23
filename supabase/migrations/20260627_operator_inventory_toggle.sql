alter table public.tenant_settings
  add column if not exists operator_inventory_enabled boolean not null default false;
