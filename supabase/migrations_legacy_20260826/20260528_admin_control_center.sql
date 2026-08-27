create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly numeric(10,2) not null default 0,
  operator_limit integer,
  appointment_limit integer,
  whatsapp_limit integer,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  status text not null default 'trialing',
  amount numeric(10,2) not null default 0,
  billing_cycle text not null default 'monthly',
  started_at timestamptz not null default timezone('utc', now()),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  subject text not null,
  description text,
  status text not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_settings (
  key text primary key default 'default',
  platform_name text not null default 'VerificWash',
  logo_url text,
  primary_domain text,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_from_email text,
  whatsapp_provider text,
  whatsapp_base_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  actor_role text not null,
  tenant_id uuid references public.tenants (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create trigger set_tenant_subscriptions_updated_at
before update on public.tenant_subscriptions
for each row execute function public.set_updated_at();

create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

insert into public.plans (code, name, price_monthly, operator_limit, appointment_limit, whatsapp_limit, features)
values
  ('starter', 'Starter', 49, 2, 100, 300, '["dashboard","fila","clientes","servicos"]'::jsonb),
  ('pro', 'Pro', 99, 8, 500, 2000, '["dashboard","fila","clientes","servicos","caixa","relatorios","whatsapp"]'::jsonb),
  ('premium', 'Premium', 149, null, null, null, '["dashboard","fila","clientes","servicos","caixa","relatorios","whatsapp","agendamentos","operadores","suporte-prioritario"]'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  operator_limit = excluded.operator_limit,
  appointment_limit = excluded.appointment_limit,
  whatsapp_limit = excluded.whatsapp_limit,
  features = excluded.features,
  is_active = true;

insert into public.platform_settings (key, platform_name)
values ('default', 'VerificWash')
on conflict (key) do nothing;

insert into public.tenant_subscriptions (tenant_id, status, amount, trial_ends_at, current_period_end)
select
  t.id,
  'trialing',
  0,
  timezone('utc', now()) + interval '14 days',
  timezone('utc', now()) + interval '14 days'
from public.tenants t
where not exists (
  select 1 from public.tenant_subscriptions ts where ts.tenant_id = t.id
);
