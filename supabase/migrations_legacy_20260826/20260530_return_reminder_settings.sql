alter table public.tenant_settings
  add column if not exists return_reminder_enabled boolean not null default false,
  add column if not exists return_reminder_days integer not null default 30,
  add column if not exists return_reminder_time text default '09:00';

update public.tenant_settings
set
  return_reminder_enabled = coalesce(return_reminder_enabled, false),
  return_reminder_days = coalesce(nullif(return_reminder_days, 0), 30),
  return_reminder_time = coalesce(nullif(return_reminder_time, ''), '09:00');
