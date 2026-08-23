alter table public.platform_settings
  add column if not exists evolution_instance text,
  add column if not exists evolution_api_key text,
  add column if not exists evolution_enabled boolean not null default false,
  add column if not exists default_return_reminder_enabled boolean not null default true,
  add column if not exists default_return_reminder_days integer not null default 30,
  add column if not exists default_return_reminder_time text default '09:00',
  add column if not exists default_queue_entry_message text,
  add column if not exists default_wash_start_message text,
  add column if not exists default_ready_message text,
  add column if not exists default_return_reminder_message text;

update public.platform_settings
set
  default_return_reminder_enabled = coalesce(default_return_reminder_enabled, true),
  default_return_reminder_days = coalesce(nullif(default_return_reminder_days, 0), 30),
  default_return_reminder_time = coalesce(nullif(default_return_reminder_time, ''), '09:00')
where key = 'default';
