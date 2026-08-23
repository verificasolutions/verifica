alter table public.tenant_settings
  add column if not exists landing_enabled boolean not null default false;
