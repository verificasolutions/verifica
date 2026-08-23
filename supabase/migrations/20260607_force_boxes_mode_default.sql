alter table public.tenant_settings
  alter column operations_mode set default 'boxes';

update public.tenant_settings
set operations_mode = 'boxes'
where operations_mode is distinct from 'boxes';
