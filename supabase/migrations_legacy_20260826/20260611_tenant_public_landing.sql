create table if not exists public.tenant_landing_pages (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  category text,
  city_label text,
  bio text,
  cover_image_url text,
  profile_image_url text,
  instagram_url text,
  facebook_url text,
  website_url text,
  address_label text,
  map_embed_url text,
  opening_hours text,
  cta_whatsapp_message text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_tenant_landing_pages_updated_at on public.tenant_landing_pages;
create trigger set_tenant_landing_pages_updated_at
before update on public.tenant_landing_pages
for each row execute function public.set_updated_at();

create table if not exists public.tenant_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_name text not null,
  rating smallint not null default 5 check (rating between 1 and 5),
  quote text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tenant_reviews_tenant_sort_idx
on public.tenant_reviews (tenant_id, sort_order asc, created_at desc);

drop trigger if exists set_tenant_reviews_updated_at on public.tenant_reviews;
create trigger set_tenant_reviews_updated_at
before update on public.tenant_reviews
for each row execute function public.set_updated_at();

alter table public.tenant_landing_pages enable row level security;
alter table public.tenant_reviews enable row level security;

grant select, insert, update on public.tenant_landing_pages to authenticated;
grant select, insert, update, delete on public.tenant_reviews to authenticated;

drop policy if exists "tenant users can read landing page" on public.tenant_landing_pages;
create policy "tenant users can read landing page"
on public.tenant_landing_pages
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can upsert landing page" on public.tenant_landing_pages;
create policy "owners managers can upsert landing page"
on public.tenant_landing_pages
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read reviews" on public.tenant_reviews;
create policy "tenant users can read reviews"
on public.tenant_reviews
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage reviews" on public.tenant_reviews;
create policy "owners managers can manage reviews"
on public.tenant_reviews
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
