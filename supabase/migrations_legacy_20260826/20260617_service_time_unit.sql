alter table public.services
  add column if not exists time_unit text not null default 'minutes';

update public.services
set time_unit = 'minutes'
where time_unit is null or btrim(time_unit) = '';
