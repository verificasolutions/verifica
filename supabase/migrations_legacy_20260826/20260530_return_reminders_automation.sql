alter table public.customers
  add column if not exists last_return_reminder_sent_at timestamptz;

insert into public.tenant_settings (
  tenant_id,
  default_service_minutes,
  evolution_enabled,
  operator_can_edit_status,
  operator_can_view_all_cars,
  operator_can_view_customer_phone,
  return_reminder_enabled,
  return_reminder_days,
  return_reminder_time
)
select
  t.id,
  30,
  false,
  true,
  true,
  false,
  false,
  30,
  '09:00'
from public.tenants t
where not exists (
  select 1
  from public.tenant_settings s
  where s.tenant_id = t.id
);

create or replace function public.ensure_tenant_settings_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_settings (
    tenant_id,
    default_service_minutes,
    evolution_enabled,
    operator_can_edit_status,
    operator_can_view_all_cars,
    operator_can_view_customer_phone,
    return_reminder_enabled,
    return_reminder_days,
    return_reminder_time
  )
  values (
    new.id,
    30,
    false,
    true,
    true,
    false,
    false,
    30,
    '09:00'
  )
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_default_tenant_settings on public.tenants;

create trigger set_default_tenant_settings
after insert on public.tenants
for each row execute function public.ensure_tenant_settings_defaults();

create or replace function public.list_due_return_reminders(p_now timestamptz)
returns table (
  tenant_id uuid,
  tenant_name text,
  customer_id uuid,
  customer_name text,
  whatsapp text,
  vehicle_model text,
  vehicle_plate text,
  service_name text,
  last_attendance_at timestamptz,
  return_reminder_message text,
  return_reminder_days integer
)
language sql
security definer
set search_path = public
as $$
  with latest_attendance as (
    select distinct on (a.customer_id)
      a.tenant_id,
      a.customer_id,
      a.created_at,
      coalesce(v.model, 'Veículo') as vehicle_model,
      coalesce(v.plate, '-') as vehicle_plate,
      coalesce(s.name, 'Lavagem') as service_name
    from public.attendances a
    left join public.vehicles v on v.id = a.vehicle_id
    left join public.services s on s.id = a.service_id
    where a.status <> 'canceled'
    order by a.customer_id, a.created_at desc
  )
  select
    c.tenant_id,
    t.name as tenant_name,
    c.id as customer_id,
    c.name as customer_name,
    regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') as whatsapp,
    la.vehicle_model,
    la.vehicle_plate,
    la.service_name,
    la.created_at as last_attendance_at,
    ts.return_reminder_message,
    ts.return_reminder_days
  from public.customers c
  join public.tenants t
    on t.id = c.tenant_id
   and t.is_active = true
  join public.tenant_settings ts
    on ts.tenant_id = c.tenant_id
  join latest_attendance la
    on la.customer_id = c.id
   and la.tenant_id = c.tenant_id
  where c.is_active = true
    and ts.evolution_enabled = true
    and nullif(ts.evolution_base_url, '') is not null
    and nullif(ts.evolution_instance, '') is not null
    and nullif(ts.evolution_api_key, '') is not null
    and ts.return_reminder_enabled = true
    and regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') <> ''
    and (
      c.last_return_reminder_sent_at is null
      or c.last_return_reminder_sent_at < la.created_at
    )
    and timezone('America/Sao_Paulo', p_now)::date
      >= (timezone('America/Sao_Paulo', la.created_at)::date + ts.return_reminder_days)
    and timezone('America/Sao_Paulo', p_now)::time
      >= coalesce(nullif(ts.return_reminder_time, ''), '09:00')::time
  order by la.created_at asc;
$$;

revoke all on function public.list_due_return_reminders(timestamptz) from public;
revoke all on function public.list_due_return_reminders(timestamptz) from anon;
revoke all on function public.list_due_return_reminders(timestamptz) from authenticated;
grant execute on function public.list_due_return_reminders(timestamptz) to service_role;
