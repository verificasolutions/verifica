alter table public.platform_settings
  add column if not exists resend_webhook_id text,
  add column if not exists resend_webhook_secret text;

create table if not exists public.lead_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  lead_company_id uuid not null references public.lead_companies (id) on delete cascade,
  lead_message_id uuid references public.lead_messages (id) on delete set null,
  provider text not null default 'resend',
  provider_email_id text not null unique,
  recipient_email text not null,
  subject text not null,
  status text not null default 'sent',
  last_event text not null default 'api_accepted',
  last_error text,
  raw_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lead_email_dispatches_status_check check (
    status in (
      'sent',
      'delivered',
      'delivery_delayed',
      'bounced',
      'complained',
      'opened',
      'clicked',
      'failed',
      'suppressed',
      'received'
    )
  )
);

create index if not exists lead_email_dispatches_company_idx
on public.lead_email_dispatches (lead_company_id, created_at desc);

create index if not exists lead_email_dispatches_status_idx
on public.lead_email_dispatches (status, created_at desc);

drop trigger if exists set_lead_email_dispatches_updated_at on public.lead_email_dispatches;
create trigger set_lead_email_dispatches_updated_at
before update on public.lead_email_dispatches
for each row execute function public.set_updated_at();

alter table public.lead_email_dispatches enable row level security;
