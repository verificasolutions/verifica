create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = target_tenant_id
      and tu.user_id = auth.uid()
      and tu.is_active = true
  );
$$;

create or replace function public.current_tenant_role(target_tenant_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select tu.role
  from public.tenant_users tu
  where tu.tenant_id = target_tenant_id
    and tu.user_id = auth.uid()
    and tu.is_active = true
  limit 1;
$$;

create or replace function public.is_tenant_owner_or_manager(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_tenant_role(target_tenant_id) in ('owner', 'manager'), false);
$$;

create or replace function public.current_employee_id(target_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.id
  from public.employees e
  where e.tenant_id = target_tenant_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1;
$$;

drop policy if exists "tenant users can read membership" on public.tenant_users;
create policy "tenant users can read own membership"
on public.tenant_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "platform admins can read platform admin records" on public.platform_admins;
create policy "platform admins can read own admin record"
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid() and is_active = true);
