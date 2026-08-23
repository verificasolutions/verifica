alter table public.tenant_settings
  add column if not exists whatsapp_pairing_token text not null default gen_random_uuid()::text;

create unique index if not exists tenant_settings_whatsapp_pairing_token_key
  on public.tenant_settings (whatsapp_pairing_token);
