alter table public.attendances
add column if not exists extra_minutes integer not null default 0;
