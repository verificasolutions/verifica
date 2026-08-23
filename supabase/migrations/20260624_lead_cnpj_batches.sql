alter table public.lead_companies
  add column if not exists cnpj text,
  add column if not exists email text,
  add column if not exists cnae_principal text,
  add column if not exists cnae_secundaria text,
  add column if not exists abertura_date date,
  add column if not exists contato_quality text,
  add column if not exists contact_risk_level text,
  add column if not exists contact_role_hint text,
  add column if not exists contact_evidence text,
  add column if not exists recommended_channel text,
  add column if not exists import_batch_label text;

create unique index if not exists lead_companies_cnpj_idx
on public.lead_companies (cnpj)
where cnpj is not null;

create index if not exists lead_companies_cnae_state_idx
on public.lead_companies (cnae_principal, state, abertura_date desc);

alter table public.lead_companies
  drop constraint if exists lead_companies_status_check;

alter table public.lead_companies
  add constraint lead_companies_status_check
  check (status in ('found', 'analyzed', 'message_generated', 'contacted', 'responded', 'demo_scheduled', 'closed_won', 'lost', 'kept', 'archived'));
