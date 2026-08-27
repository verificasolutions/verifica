alter table public.tenant_settings
  add column if not exists operation_flow_locked boolean not null default true;

update public.tenant_settings
set operation_flow_locked = true
where operation_flow_locked is distinct from true and operation_flow_locked is null;
