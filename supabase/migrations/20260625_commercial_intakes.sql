create table if not exists public.commercial_intakes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  full_name text not null,
  email text not null,
  whatsapp text not null,
  contact_phone text,
  legal_name text,
  trade_name text,
  document text not null,
  document_type text not null check (document_type in ('cpf', 'cnpj')),
  state_registration text,
  municipal_registration text,
  postal_code text not null,
  street text not null,
  street_number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  current_situation text,
  selected_plan_code text not null,
  selected_plan_name text not null,
  implementation_fee numeric(10, 2),
  recurring_fee numeric(10, 2),
  contract_version text not null,
  contract_title text not null,
  contract_body text not null,
  contract_accepted boolean not null default false,
  contract_accepted_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted', 'awaiting_payment', 'paid', 'active', 'archived')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_confirmed_at timestamptz,
  contract_email_sent_at timestamptz,
  contract_email_error text,
  internal_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists commercial_intakes_status_idx
on public.commercial_intakes (status, payment_status, created_at desc);

create index if not exists commercial_intakes_email_idx
on public.commercial_intakes (email);

create index if not exists commercial_intakes_document_idx
on public.commercial_intakes (document);

drop trigger if exists set_commercial_intakes_updated_at on public.commercial_intakes;
create trigger set_commercial_intakes_updated_at
before update on public.commercial_intakes
for each row execute function public.set_updated_at();

alter table public.commercial_intakes enable row level security;

create policy "platform admins can read commercial intakes"
on public.commercial_intakes
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
  )
);

create policy "platform admins can update commercial intakes"
on public.commercial_intakes
for update
to authenticated
using (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
  )
);
