alter table public.tenant_settings
  add column if not exists instagram_enabled boolean not null default false,
  add column if not exists instagram_auto_publish_enabled boolean not null default false,
  add column if not exists instagram_default_publish_mode text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_settings_instagram_default_publish_mode_check'
  ) then
    alter table public.tenant_settings
      add constraint tenant_settings_instagram_default_publish_mode_check
      check (instagram_default_publish_mode in ('manual'));
  end if;
end $$;

create table if not exists public.tenant_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  instagram_account_id text not null,
  facebook_page_id text,
  account_name text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tenant_instagram_accounts_tenant_idx
  on public.tenant_instagram_accounts (tenant_id, created_at desc);

create unique index if not exists tenant_instagram_accounts_active_tenant_idx
  on public.tenant_instagram_accounts (tenant_id)
  where is_active = true;

drop trigger if exists set_tenant_instagram_accounts_updated_at on public.tenant_instagram_accounts;
create trigger set_tenant_instagram_accounts_updated_at
before update on public.tenant_instagram_accounts
for each row execute function public.set_updated_at();

alter table public.tenant_instagram_accounts enable row level security;

grant select, insert, update on public.tenant_instagram_accounts to authenticated;

drop policy if exists "owners managers can read instagram accounts" on public.tenant_instagram_accounts;
create policy "owners managers can read instagram accounts"
on public.tenant_instagram_accounts
for select
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can insert instagram accounts" on public.tenant_instagram_accounts;
create policy "owners managers can insert instagram accounts"
on public.tenant_instagram_accounts
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update instagram accounts" on public.tenant_instagram_accounts;
create policy "owners managers can update instagram accounts"
on public.tenant_instagram_accounts
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  marketing_asset_id uuid not null references public.marketing_assets (id) on delete cascade,
  platform text not null,
  status text not null default 'pending',
  instagram_media_id text,
  instagram_publish_id text,
  published_at timestamptz,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists social_publications_tenant_created_idx
  on public.social_publications (tenant_id, created_at desc);

create index if not exists social_publications_asset_created_idx
  on public.social_publications (marketing_asset_id, created_at desc);

drop trigger if exists set_social_publications_updated_at on public.social_publications;
create trigger set_social_publications_updated_at
before update on public.social_publications
for each row execute function public.set_updated_at();

alter table public.social_publications enable row level security;

grant select, insert, update on public.social_publications to authenticated;

drop policy if exists "tenant users can read social publications" on public.social_publications;
create policy "tenant users can read social publications"
on public.social_publications
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert social publications" on public.social_publications;
create policy "owners managers can insert social publications"
on public.social_publications
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update social publications" on public.social_publications;
create policy "owners managers can update social publications"
on public.social_publications
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
