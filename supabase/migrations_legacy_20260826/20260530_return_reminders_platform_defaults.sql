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
  ),
  platform as (
    select *
    from public.platform_settings
    where key = 'default'
    limit 1
  ),
  effective as (
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
      case
        when ts.return_reminder_enabled = true
          or ts.return_reminder_days <> 30
          or coalesce(ts.return_reminder_time, '09:00') <> '09:00'
          or ts.return_reminder_message is not null
          then ts.return_reminder_message
        else p.default_return_reminder_message
      end as effective_return_reminder_message,
      case
        when ts.return_reminder_enabled = true
          or ts.return_reminder_days <> 30
          or coalesce(ts.return_reminder_time, '09:00') <> '09:00'
          or ts.return_reminder_message is not null
          then ts.return_reminder_enabled
        else coalesce(p.default_return_reminder_enabled, true)
      end as effective_return_reminder_enabled,
      case
        when ts.return_reminder_enabled = true
          or ts.return_reminder_days <> 30
          or coalesce(ts.return_reminder_time, '09:00') <> '09:00'
          or ts.return_reminder_message is not null
          then ts.return_reminder_days
        else coalesce(p.default_return_reminder_days, 30)
      end as effective_return_reminder_days,
      case
        when ts.return_reminder_enabled = true
          or ts.return_reminder_days <> 30
          or coalesce(ts.return_reminder_time, '09:00') <> '09:00'
          or ts.return_reminder_message is not null
          then coalesce(ts.return_reminder_time, '09:00')
        else coalesce(nullif(p.default_return_reminder_time, ''), '09:00')
      end as effective_return_reminder_time,
      case
        when ts.evolution_enabled = true
          and nullif(ts.evolution_base_url, '') is not null
          and nullif(ts.evolution_instance, '') is not null
          and nullif(ts.evolution_api_key, '') is not null
          then true
        else coalesce(p.evolution_enabled, false)
          and nullif(p.whatsapp_base_url, '') is not null
          and nullif(p.evolution_instance, '') is not null
          and nullif(p.evolution_api_key, '') is not null
      end as effective_whatsapp_enabled
    from public.customers c
    join public.tenants t
      on t.id = c.tenant_id
     and t.is_active = true
    left join public.tenant_settings ts
      on ts.tenant_id = c.tenant_id
    cross join platform p
    join latest_attendance la
      on la.customer_id = c.id
     and la.tenant_id = c.tenant_id
    where c.is_active = true
  )
  select
    tenant_id,
    tenant_name,
    customer_id,
    customer_name,
    whatsapp,
    vehicle_model,
    vehicle_plate,
    service_name,
    last_attendance_at,
    effective_return_reminder_message as return_reminder_message,
    effective_return_reminder_days as return_reminder_days
  from effective
  where effective_whatsapp_enabled = true
    and effective_return_reminder_enabled = true
    and whatsapp <> ''
    and timezone('America/Sao_Paulo', p_now)::date
      >= (timezone('America/Sao_Paulo', last_attendance_at)::date + effective_return_reminder_days)
    and timezone('America/Sao_Paulo', p_now)::time >= effective_return_reminder_time::time
    and (
      not exists (
        select 1
        from public.customers c2
        where c2.id = effective.customer_id
          and c2.last_return_reminder_sent_at is not null
          and c2.last_return_reminder_sent_at >= effective.last_attendance_at
      )
    )
  order by last_attendance_at asc;
$$;

revoke all on function public.list_due_return_reminders(timestamptz) from public;
revoke all on function public.list_due_return_reminders(timestamptz) from anon;
revoke all on function public.list_due_return_reminders(timestamptz) from authenticated;
grant execute on function public.list_due_return_reminders(timestamptz) to service_role;
