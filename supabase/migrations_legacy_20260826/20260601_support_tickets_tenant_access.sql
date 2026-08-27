drop policy if exists "tenant users can read support tickets" on public.support_tickets;
create policy "tenant users can read support tickets"
on public.support_tickets
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert support tickets" on public.support_tickets;
create policy "owners managers can insert support tickets"
on public.support_tickets
for insert
to authenticated
with check (
  public.is_tenant_member(tenant_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = tenant_id
      and tu.user_id = auth.uid()
      and tu.is_active = true
      and tu.role in ('owner', 'manager')
  )
);
