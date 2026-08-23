alter table public.platform_settings
  add column if not exists resend_from_email text,
  add column if not exists resend_reply_to_email text;

alter table public.lead_messages
  add column if not exists subject text;
