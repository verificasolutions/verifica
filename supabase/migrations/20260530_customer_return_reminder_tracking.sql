alter table public.customers
  add column if not exists last_return_reminder_sent_at timestamptz;
