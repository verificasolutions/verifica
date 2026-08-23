alter table public.services
  add column if not exists base_service_id uuid references public.services (id) on delete set null,
  add column if not exists addon_minutes integer not null default 0,
  add column if not exists addon_price_passeio numeric(10, 2) not null default 0,
  add column if not exists addon_price_medio numeric(10, 2) not null default 0,
  add column if not exists addon_price_grande numeric(10, 2) not null default 0,
  add column if not exists addon_price_bem_grande numeric(10, 2) not null default 0;

update public.services
set
  addon_minutes = coalesce(addon_minutes, average_minutes),
  addon_price_passeio = coalesce(addon_price_passeio, price_passeio, price),
  addon_price_medio = coalesce(addon_price_medio, price_medio, price),
  addon_price_grande = coalesce(addon_price_grande, price_grande, price),
  addon_price_bem_grande = coalesce(addon_price_bem_grande, price_bem_grande, price);
