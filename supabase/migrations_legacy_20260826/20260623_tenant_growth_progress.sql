create table if not exists public.tenant_growth_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  step_key text not null,
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists tenant_growth_progress_tenant_step_uidx
on public.tenant_growth_progress (tenant_id, step_key);

create index if not exists tenant_growth_progress_tenant_completed_idx
on public.tenant_growth_progress (tenant_id, completed, updated_at desc);

drop trigger if exists set_tenant_growth_progress_updated_at on public.tenant_growth_progress;
create trigger set_tenant_growth_progress_updated_at
before update on public.tenant_growth_progress
for each row execute function public.set_updated_at();

alter table public.tenant_growth_progress enable row level security;

grant select, insert, update on public.tenant_growth_progress to authenticated;

drop policy if exists "tenant users can read tenant growth progress" on public.tenant_growth_progress;
create policy "tenant users can read tenant growth progress"
on public.tenant_growth_progress
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage tenant growth progress" on public.tenant_growth_progress;
create policy "owners managers can manage tenant growth progress"
on public.tenant_growth_progress
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));
