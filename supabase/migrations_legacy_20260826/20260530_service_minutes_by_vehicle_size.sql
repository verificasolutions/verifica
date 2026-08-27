alter table public.services
  add column if not exists minutes_passeio integer not null default 0,
  add column if not exists minutes_medio integer not null default 0,
  add column if not exists minutes_grande integer not null default 0,
  add column if not exists minutes_bem_grande integer not null default 0,
  add column if not exists addon_minutes_passeio integer not null default 0,
  add column if not exists addon_minutes_medio integer not null default 0,
  add column if not exists addon_minutes_grande integer not null default 0,
  add column if not exists addon_minutes_bem_grande integer not null default 0;

update public.services
set
  minutes_passeio = coalesce(nullif(minutes_passeio, 0), average_minutes),
  minutes_medio = coalesce(nullif(minutes_medio, 0), average_minutes),
  minutes_grande = coalesce(nullif(minutes_grande, 0), average_minutes),
  minutes_bem_grande = coalesce(nullif(minutes_bem_grande, 0), average_minutes),
  addon_minutes_passeio = coalesce(nullif(addon_minutes_passeio, 0), average_minutes),
  addon_minutes_medio = coalesce(nullif(addon_minutes_medio, 0), average_minutes),
  addon_minutes_grande = coalesce(nullif(addon_minutes_grande, 0), average_minutes),
  addon_minutes_bem_grande = coalesce(nullif(addon_minutes_bem_grande, 0), average_minutes);
