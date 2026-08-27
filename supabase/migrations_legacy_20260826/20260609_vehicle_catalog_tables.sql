create table if not exists public.vehicle_catalog_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vehicle_catalog_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_catalog_brands (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (brand_id, name)
);

create table if not exists public.vehicle_catalog_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vehicle_catalog_brands_name_idx on public.vehicle_catalog_brands (name);
create index if not exists vehicle_catalog_models_brand_name_idx on public.vehicle_catalog_models (brand_id, name);
create index if not exists vehicle_catalog_colors_name_idx on public.vehicle_catalog_colors (name);

alter table public.vehicle_catalog_brands enable row level security;
alter table public.vehicle_catalog_models enable row level security;
alter table public.vehicle_catalog_colors enable row level security;

grant select on public.vehicle_catalog_brands to authenticated;
grant select on public.vehicle_catalog_models to authenticated;
grant select on public.vehicle_catalog_colors to authenticated;

create policy "authenticated can read vehicle catalog brands"
on public.vehicle_catalog_brands
for select
to authenticated
using (true);

create policy "authenticated can read vehicle catalog models"
on public.vehicle_catalog_models
for select
to authenticated
using (true);

create policy "authenticated can read vehicle catalog colors"
on public.vehicle_catalog_colors
for select
to authenticated
using (true);
