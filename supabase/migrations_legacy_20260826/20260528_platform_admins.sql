create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'admin_master',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_platform_admins_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

alter table public.platform_admins enable row level security;

grant select on public.platform_admins to authenticated;

create policy "platform admins can read platform admin records"
on public.platform_admins
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
  )
);
