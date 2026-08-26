-- Portal do Cliente — Fundação de autenticação e proteção.
-- Superprompt §2/§3/§11: telefone normalizado único por tenant, credencial com hash seguro,
-- sessão própria separada do Supabase Auth interno e rate limit por chave.
-- Deny-by-default: tabelas novas sem grants anon; escrita/leitura somente server-side
-- (admin client / RPCs com validação de token de sessão).

-- 1) customers.phone_normalized — dígitos nacionais (10/11, sem +55, sem espaços/hífens)
alter table public.customers
  add column if not exists phone_normalized text;

update public.customers
set phone_normalized = nullif(
  regexp_replace(coalesce(contact_phone_1, whatsapp, ''), '\D+', '', 'g'),
  ''
)
where phone_normalized is null
  and (contact_phone_1 is not null or whatsapp is not null);

-- Deduplicação defensiva antes do índice único: para duplicatas dentro do mesmo tenant,
-- mantém o registro mais antigo (created_at, id) e zera o restante (dados originais preservados).
update public.customers c
set phone_normalized = null
where c.phone_normalized is not null
  and exists (
    select 1
    from public.customers c2
    where c2.tenant_id = c.tenant_id
      and c2.phone_normalized = c.phone_normalized
      and (c2.created_at < c.created_at or (c2.created_at = c.created_at and c2.id < c.id))
  );

create unique index if not exists customers_tenant_phone_normalized_key
  on public.customers (tenant_id, phone_normalized)
  where phone_normalized is not null;

-- 2) customer_credentials — 1:1 com customers; hash scrypt autocontido (gerado no backend TS)
--    Conformidade: uuid (pk = customer_id), tenant_id, created_at, updated_at. created_by N/A
--    (o autor é o próprio cliente, representado pela FK customer_id). Soft delete N/A (cascade).
create table if not exists public.customer_credentials (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_credentials_tenant_idx
  on public.customer_credentials (tenant_id);

drop trigger if exists set_customer_credentials_updated_at on public.customer_credentials;
create trigger set_customer_credentials_updated_at
before update on public.customer_credentials
for each row execute function public.set_updated_at();

alter table public.customer_credentials enable row level security;
-- Sem policies/grants: somente server-side.

-- 3) customer_sessions — sessão própria do cliente (cookie httpOnly; token nunca persiste, só hash)
--    Conformidade: uuid, tenant_id, created_at, updated_at, created_by N/A (autor = cliente via FK),
--    soft delete equivalente via revoked_at.
create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_ip inet,
  user_agent text
);

create index if not exists customer_sessions_customer_expires_idx
  on public.customer_sessions (customer_id, expires_at);

create index if not exists customer_sessions_tenant_idx
  on public.customer_sessions (tenant_id);

drop trigger if exists set_customer_sessions_updated_at on public.customer_sessions;
create trigger set_customer_sessions_updated_at
before update on public.customer_sessions
for each row execute function public.set_updated_at();

alter table public.customer_sessions enable row level security;
-- Sem policies/grants: somente server-side (admin client) e RPCs com validação de token.

-- 4) rate_limits — por IP/tenant/telefone/placa (§11); escrita via RPC rate_limit_increment (M6)
--    Conformidade: uuid, tenant_id OBRIGATÓRIO (decisão do Codex), created_at, updated_at.
--    created_by/soft delete N/A (contador efêmero).
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  count integer not null default 1,
  reset_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, key)
);

create index if not exists rate_limits_reset_at_idx
  on public.rate_limits (reset_at);

drop trigger if exists set_rate_limits_updated_at on public.rate_limits;
create trigger set_rate_limits_updated_at
before update on public.rate_limits
for each row execute function public.set_updated_at();

alter table public.rate_limits enable row level security;
-- Sem policies/grants: somente server-side via função security definer.
