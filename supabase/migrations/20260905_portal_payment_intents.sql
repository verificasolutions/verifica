-- Portal do Cliente — Fronteira de pagamento (§10) e idempotência de ordem.
-- Estados aprovados: not_required | pending | succeeded | failed | refunded | canceled.
-- Primeiro tenant: payment_mode = 'order_without_online_payment' — sem gateway; a ordem é
-- criada SEM exigir succeeded e NUNCA é marcada como paga. Estrutura extensível para
-- tenants futuros com gateway (online_required).
-- Idempotência de contratação (decisão aprovada): o cliente envia uma idempotency_key única
-- por tentativa; constraint = tenant_id + idempotency_key. O mesmo cliente/veículo pode
-- criar novas ordens legítimas em momentos diferentes (novas chaves).

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  attendance_id uuid references public.attendances (id) on delete set null,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('not_required', 'pending', 'succeeded', 'failed', 'refunded', 'canceled')),
  payment_method text check (payment_method in ('pix', 'card', 'cash', 'other')),
  provider text,
  provider_reference text,
  idempotency_key text not null,
  succeeded_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  canceled_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_ip inet
);

create unique index if not exists payment_intents_idempotency_key_idx
  on public.payment_intents (idempotency_key);

create unique index if not exists payment_intents_tenant_idempotency_idx
  on public.payment_intents (tenant_id, idempotency_key);

create index if not exists payment_intents_tenant_customer_status_idx
  on public.payment_intents (tenant_id, customer_id, status);

create index if not exists payment_intents_attendance_idx
  on public.payment_intents (attendance_id);

drop trigger if exists set_payment_intents_updated_at on public.payment_intents;
create trigger set_payment_intents_updated_at
before update on public.payment_intents
for each row execute function public.set_updated_at();

alter table public.payment_intents enable row level security;
-- Conformidade: uuid, tenant_id, created_at, updated_at. created_by N/A (autor = cliente via
-- customer_id). Soft delete N/A (lifecycle por status: not_required/pending/succeeded/failed/refunded/canceled).

-- attendances: idempotência por tentativa (tenant_id + idempotency_key), origem e vínculo 1:1 com intent.
alter table public.attendances
  add column if not exists idempotency_key text,
  add column if not exists source text not null default 'operator',
  add column if not exists payment_intent_id uuid references public.payment_intents (id) on delete set null;

create unique index if not exists attendances_tenant_idempotency_key_idx
  on public.attendances (tenant_id, idempotency_key)
  where idempotency_key is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendances_source_check') then
    alter table public.attendances
      add constraint attendances_source_check
      check (source in ('operator', 'portal', 'appointment'));
  end if;
end
$$;

-- tenant_settings: modo de pagamento configurado por tenant + métodos aceitos no local (informativo).
alter table public.tenant_settings
  add column if not exists payment_mode text not null default 'order_without_online_payment',
  add column if not exists portal_payment_methods jsonb not null default '["cash","pix","card"]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_settings_payment_mode_check') then
    alter table public.tenant_settings
      add constraint tenant_settings_payment_mode_check
      check (payment_mode in ('order_without_online_payment', 'online_required'));
  end if;
end
$$;
