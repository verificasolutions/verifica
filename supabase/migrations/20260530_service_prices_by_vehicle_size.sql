alter table public.services
  add column if not exists price_passeio numeric(10, 2) not null default 0,
  add column if not exists price_medio numeric(10, 2) not null default 0,
  add column if not exists price_grande numeric(10, 2) not null default 0,
  add column if not exists price_bem_grande numeric(10, 2) not null default 0;

update public.services
set
  price_passeio = coalesce(nullif(price_passeio, 0), price),
  price_medio = coalesce(nullif(price_medio, 0), price),
  price_grande = coalesce(nullif(price_grande, 0), price),
  price_bem_grande = coalesce(nullif(price_bem_grande, 0), price);
