alter table public.employees
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists is_present boolean not null default false;
