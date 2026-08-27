create table if not exists public.customer_privacy_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  policy_version text not null,
  consent_type text not null default 'privacy_notice' check (consent_type = 'privacy_notice'),
  accepted_at timestamptz not null default timezone('utc', now()),
  source text not null default 'customer_portal',
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, consent_type, policy_version)
);

create index if not exists customer_privacy_consents_tenant_idx
  on public.customer_privacy_consents (tenant_id, accepted_at desc);

alter table public.customer_privacy_consents enable row level security;
revoke all on public.customer_privacy_consents from anon, authenticated;
grant all on public.customer_privacy_consents to service_role;
