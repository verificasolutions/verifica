begin;

alter table public.customers
  add column if not exists gender text,
  add column if not exists birth_date date;

alter table public.customers drop constraint if exists customers_gender_check;
alter table public.customers add constraint customers_gender_check
  check (gender is null or gender in ('female', 'male', 'non_binary', 'other'));

commit;
