create table if not exists public.employee_work_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  logged_in_at timestamptz not null default timezone('utc', now()),
  logged_out_at timestamptz,
  ended_by_shift boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists employee_work_sessions_one_open_idx
on public.employee_work_sessions (employee_id)
where logged_out_at is null;

create index if not exists employee_work_sessions_tenant_employee_idx
on public.employee_work_sessions (tenant_id, employee_id, logged_in_at desc);

alter table public.employee_work_sessions enable row level security;

grant select on public.employee_work_sessions to authenticated;

create policy "tenant users can read employee work sessions"
on public.employee_work_sessions
for select
to authenticated
using (public.is_tenant_member(tenant_id));
