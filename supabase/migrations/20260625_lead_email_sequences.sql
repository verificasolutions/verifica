create table if not exists public.lead_email_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.lead_email_sequences (id) on delete cascade,
  step_number integer not null check (step_number between 1 and 6),
  subject text,
  body_text text,
  image_url text,
  delay_days integer not null default 7 check (delay_days >= 0 and delay_days <= 365),
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sequence_id, step_number)
);

create table if not exists public.lead_email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_company_id uuid not null references public.lead_companies (id) on delete cascade,
  sequence_id uuid not null references public.lead_email_sequences (id) on delete cascade,
  current_step integer not null default 0 check (current_step between 0 and 6),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'failed', 'unsubscribed')),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (lead_company_id, sequence_id)
);

create index if not exists lead_email_sequence_steps_sequence_idx
on public.lead_email_sequence_steps (sequence_id, step_number);

create index if not exists lead_email_sequence_enrollments_due_idx
on public.lead_email_sequence_enrollments (status, next_send_at);

create index if not exists lead_email_sequence_enrollments_company_idx
on public.lead_email_sequence_enrollments (lead_company_id, created_at desc);

drop trigger if exists set_lead_email_sequences_updated_at on public.lead_email_sequences;
create trigger set_lead_email_sequences_updated_at
before update on public.lead_email_sequences
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_email_sequence_steps_updated_at on public.lead_email_sequence_steps;
create trigger set_lead_email_sequence_steps_updated_at
before update on public.lead_email_sequence_steps
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_email_sequence_enrollments_updated_at on public.lead_email_sequence_enrollments;
create trigger set_lead_email_sequence_enrollments_updated_at
before update on public.lead_email_sequence_enrollments
for each row execute function public.set_updated_at();

alter table public.lead_email_sequences enable row level security;
alter table public.lead_email_sequence_steps enable row level security;
alter table public.lead_email_sequence_enrollments enable row level security;

with upsert_sequence as (
  insert into public.lead_email_sequences (sequence_key, name, is_active)
  values ('lead-default', 'Cadência padrão de prospecção', true)
  on conflict (sequence_key) do update
  set name = excluded.name,
      is_active = excluded.is_active
  returning id
)
insert into public.lead_email_sequence_steps (sequence_id, step_number, subject, body_text, image_url, delay_days, is_active)
select
  upsert_sequence.id,
  steps.step_number,
  steps.subject,
  steps.body_text,
  steps.image_url,
  steps.delay_days,
  steps.is_active
from upsert_sequence
cross join (
  values
    (
      1,
      'Ainda controla tudo no caderno e no WhatsApp?',
      E'Não adianta ser bom se ninguém te encontra.\n\nSe sua empresa não aparece no Google Maps, não publica seus trabalhos e não mantém contato com seus clientes, você está perdendo dinheiro todos os dias para concorrentes piores que você.\n\nPode doer ouvir isso, mas é verdade.\n\nEnquanto você trabalha, outros estão aparecendo.\n\nE quem aparece vende.\n\nAinda usa caderno, caderneta, planilhas ou conversa de WhatsApp para tentar controlar o dia a dia?\n\nAinda perde tempo procurando informações, tentando lembrar quem pediu orçamento ou quando foi o último atendimento de um cliente?\n\nChega disso.\n\nO Verifica coloca seu negócio no Google, fortalece seu Instagram, cria sua presença online e ajuda a transformar cada serviço realizado em divulgação para atrair novos clientes.\n\nE de quebra você ainda organiza:\n\n✅ Serviços\n✅ Clientes\n✅ Equipe\n✅ Estoque\n✅ Caixa\n✅ Entradas e saídas\n✅ Lembretes automáticos\n✅ Atualizações para clientes\n\nMenos papel.\nMenos bagunça.\nMais clientes.\n\nPorque só é visto quem aparece.\n\nE só vende quem é lembrado.',
      'https://www.verificasolutions.com.br/lead-email-dashboard-auto.jpg',
      7,
      true
    ),
    (2, '', '', null, 7, false),
    (3, '', '', null, 7, false),
    (4, '', '', null, 7, false),
    (5, '', '', null, 7, false),
    (6, '', '', null, 7, false)
) as steps(step_number, subject, body_text, image_url, delay_days, is_active)
on conflict (sequence_id, step_number) do update
set subject = excluded.subject,
    body_text = excluded.body_text,
    image_url = excluded.image_url,
    delay_days = excluded.delay_days,
    is_active = excluded.is_active;
