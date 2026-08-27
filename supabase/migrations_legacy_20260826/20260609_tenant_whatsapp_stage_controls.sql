alter table public.tenant_settings
  add column if not exists customer_messages_enabled boolean not null default false,
  add column if not exists queue_entry_message_enabled boolean not null default true,
  add column if not exists wash_start_message_enabled boolean not null default false,
  add column if not exists finishing_message text,
  add column if not exists finishing_message_enabled boolean not null default false,
  add column if not exists ready_message_enabled boolean not null default true;

update public.tenant_settings
set
  customer_messages_enabled = coalesce(customer_messages_enabled, evolution_enabled, false),
  queue_entry_message_enabled = coalesce(queue_entry_message_enabled, true),
  wash_start_message_enabled = coalesce(wash_start_message_enabled, false),
  finishing_message_enabled = coalesce(finishing_message_enabled, false),
  ready_message_enabled = coalesce(ready_message_enabled, true);
