alter table public.services
  add column if not exists price_app_passeio numeric(10, 2) not null default 0,
  add column if not exists price_app_medio numeric(10, 2) not null default 0,
  add column if not exists price_app_grande numeric(10, 2) not null default 0,
  add column if not exists price_app_bem_grande numeric(10, 2) not null default 0,
  add column if not exists addon_price_app_passeio numeric(10, 2) not null default 0,
  add column if not exists addon_price_app_medio numeric(10, 2) not null default 0,
  add column if not exists addon_price_app_grande numeric(10, 2) not null default 0,
  add column if not exists addon_price_app_bem_grande numeric(10, 2) not null default 0;

update public.services
set
  price_app_passeio = case when price_app_passeio = 0 then coalesce(price_passeio, price) else price_app_passeio end,
  price_app_medio = case when price_app_medio = 0 then coalesce(price_medio, price) else price_app_medio end,
  price_app_grande = case when price_app_grande = 0 then coalesce(price_grande, price) else price_app_grande end,
  price_app_bem_grande = case when price_app_bem_grande = 0 then coalesce(price_bem_grande, price) else price_app_bem_grande end,
  addon_price_app_passeio = case when addon_price_app_passeio = 0 then coalesce(addon_price_passeio, price_passeio, price) else addon_price_app_passeio end,
  addon_price_app_medio = case when addon_price_app_medio = 0 then coalesce(addon_price_medio, price_medio, price) else addon_price_app_medio end,
  addon_price_app_grande = case when addon_price_app_grande = 0 then coalesce(addon_price_grande, price_grande, price) else addon_price_app_grande end,
  addon_price_app_bem_grande = case when addon_price_app_bem_grande = 0 then coalesce(addon_price_bem_grande, price_bem_grande, price) else addon_price_app_bem_grande end;

alter table public.tenant_settings
  add column if not exists vehicle_type_tier_overrides jsonb not null default '{}'::jsonb;
