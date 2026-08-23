alter table public.support_tickets
  add column if not exists admin_reply text,
  add column if not exists admin_reply_at timestamptz,
  add column if not exists admin_reply_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attendance_id uuid references public.attendances (id) on delete set null,
  media_id uuid references public.attendance_media (id) on delete set null,
  kind text not null,
  title text,
  generated_text text not null,
  cta text,
  hashtags text[] not null default '{}',
  status text not null default 'draft',
  prompt_snapshot jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists marketing_assets_tenant_created_idx
on public.marketing_assets (tenant_id, created_at desc);

create index if not exists marketing_assets_attendance_idx
on public.marketing_assets (attendance_id, created_at desc);

drop trigger if exists set_marketing_assets_updated_at on public.marketing_assets;
create trigger set_marketing_assets_updated_at
before update on public.marketing_assets
for each row execute function public.set_updated_at();

alter table public.marketing_assets enable row level security;

grant select, insert, update on public.marketing_assets to authenticated;

drop policy if exists "tenant users can read marketing assets" on public.marketing_assets;
create policy "tenant users can read marketing assets"
on public.marketing_assets
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert marketing assets" on public.marketing_assets;
create policy "owners managers can insert marketing assets"
on public.marketing_assets
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update marketing assets" on public.marketing_assets;
create policy "owners managers can update marketing assets"
on public.marketing_assets
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
