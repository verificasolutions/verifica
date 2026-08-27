alter table public.tenant_settings
  add column if not exists logout_before timestamptz;
