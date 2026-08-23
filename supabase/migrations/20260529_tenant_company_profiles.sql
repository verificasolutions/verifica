create table if not exists public.tenant_company_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  legal_name text not null,
  trade_name text not null,
  cnpj text,
  state_registration text,
  municipal_registration text,
  email text,
  phone text,
  phone_secondary text,
  postal_code text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country text not null default 'Brasil',
  representative_name text not null,
  representative_role text,
  representative_email text not null,
  representative_phone text,
  representative_phone_secondary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_tenant_company_profiles_updated_at
before update on public.tenant_company_profiles
for each row execute function public.set_updated_at();

alter table public.tenant_company_profiles enable row level security;

grant select, insert, update on public.tenant_company_profiles to authenticated;

create policy "tenant users can read company profile"
on public.tenant_company_profiles
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "owners managers can insert company profile"
on public.tenant_company_profiles
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

create policy "owners managers can update company profile"
on public.tenant_company_profiles
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
