drop policy if exists "operators can insert own attendance media" on public.attendance_media;
create policy "operators can insert own attendance media"
on public.attendance_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attendances a
    where a.id = attendance_media.attendance_id
      and a.tenant_id = attendance_media.tenant_id
      and public.current_tenant_role(a.tenant_id) = 'operator'
      and a.employee_id = public.current_employee_id(a.tenant_id)
  )
);

drop policy if exists "owners managers can insert support tickets" on public.support_tickets;
create policy "owners managers can insert support tickets"
on public.support_tickets
for insert
to authenticated
with check (
  public.is_tenant_member(support_tickets.tenant_id)
  and support_tickets.created_by = auth.uid()
  and exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = support_tickets.tenant_id
      and tu.user_id = auth.uid()
      and tu.is_active = true
      and tu.role in ('owner', 'manager')
  )
);
