alter table public.tenant_landing_pages
add column if not exists background_style text not null default 'dark';
