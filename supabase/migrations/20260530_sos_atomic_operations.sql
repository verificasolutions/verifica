create unique index if not exists cash_sessions_one_open_per_tenant_idx
on public.cash_sessions (tenant_id)
where status = 'open';

create or replace function public.toggle_employee_presence_atomic(
  p_employee_id uuid,
  p_is_present boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_description text;
  v_cash_session_id uuid;
begin
  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and is_active = true;

  if v_employee.id is null then
    raise exception 'Funcionário não encontrado.';
  end if;

  if not public.is_tenant_owner_or_manager(v_employee.tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  update public.employees
  set is_present = p_is_present
  where id = v_employee.id
    and tenant_id = v_employee.tenant_id;

  if v_employee.payment_type = 'daily' then
    v_description := 'DIARIA:' || v_employee.id || ':' || v_employee.name;

    if p_is_present then
      if not exists (
        select 1
        from public.cash_entries
        where tenant_id = v_employee.tenant_id
          and kind = 'expense'
          and description = v_description
          and timezone('America/Sao_Paulo', created_at)::date = timezone('America/Sao_Paulo', now())::date
      ) then
        select id
        into v_cash_session_id
        from public.cash_sessions
        where tenant_id = v_employee.tenant_id
          and status = 'open'
        order by opened_at desc
        limit 1;

        insert into public.cash_entries (
          tenant_id,
          cash_session_id,
          kind,
          payment_method,
          description,
          amount,
          created_by
        ) values (
          v_employee.tenant_id,
          v_cash_session_id,
          'expense',
          'pending',
          v_description,
          v_employee.payment_value,
          auth.uid()
        );
      end if;
    else
      delete from public.cash_entries
      where tenant_id = v_employee.tenant_id
        and kind = 'expense'
        and description = v_description
        and payment_method = 'pending'
        and timezone('America/Sao_Paulo', created_at)::date = timezone('America/Sao_Paulo', now())::date;
    end if;
  end if;
end;
$$;

create or replace function public.mark_daily_payout_paid_atomic(
  p_employee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_description text;
  v_cash_session_id uuid;
  v_cash_entry_id uuid;
begin
  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and is_active = true;

  if v_employee.id is null then
    raise exception 'Funcionário inválido para diária.';
  end if;

  if not public.is_tenant_owner_or_manager(v_employee.tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  if v_employee.payment_type <> 'daily' or not v_employee.is_present then
    raise exception 'Funcionário inválido para diária.';
  end if;

  select id
  into v_cash_session_id
  from public.cash_sessions
  where tenant_id = v_employee.tenant_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_cash_session_id is null then
    raise exception 'Abra o caixa antes de marcar a diária como paga.';
  end if;

  v_description := 'DIARIA:' || v_employee.id || ':' || v_employee.name;

  update public.cash_entries
  set payment_method = 'cash',
      cash_session_id = v_cash_session_id
  where id = (
    select id
    from public.cash_entries
    where tenant_id = v_employee.tenant_id
      and kind = 'expense'
      and description = v_description
      and payment_method = 'pending'
      and timezone('America/Sao_Paulo', created_at)::date = timezone('America/Sao_Paulo', now())::date
    order by created_at desc
    limit 1
  )
  returning id into v_cash_entry_id;

  if v_cash_entry_id is null then
    raise exception 'Diária pendente não encontrada.';
  end if;

  return v_cash_entry_id;
end;
$$;

create or replace function public.create_cash_entry_atomic(
  p_tenant_id uuid,
  p_kind public.cash_entry_kind,
  p_payment_method public.payment_method,
  p_description text,
  p_amount numeric,
  p_identifier_type text default null,
  p_identifier_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash_session_id uuid;
  v_attendance_id uuid;
  v_attendance_customer text;
  v_attendance_plate text;
  v_attendance_service text;
  v_final_description text;
  v_identifier_value text;
  v_cash_entry_id uuid;
begin
  if not public.is_tenant_owner_or_manager(p_tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Dados inválidos para lançamento.';
  end if;

  select id
  into v_cash_session_id
  from public.cash_sessions
  where tenant_id = p_tenant_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_cash_session_id is null then
    raise exception 'Abra o caixa antes de registrar movimentações.';
  end if;

  v_final_description := nullif(trim(coalesce(p_description, '')), '');

  if p_kind = 'income' and nullif(trim(coalesce(p_identifier_type, '')), '') is not null and nullif(trim(coalesce(p_identifier_value, '')), '') is not null then
    if p_identifier_type = 'whatsapp' then
      v_identifier_value := regexp_replace(lower(p_identifier_value), '\D', '', 'g');
    elsif p_identifier_type = 'plate' then
      v_identifier_value := regexp_replace(lower(p_identifier_value), '[^a-z0-9]', '', 'g');
    else
      v_identifier_value := lower(trim(p_identifier_value));
    end if;

    select
      a.id,
      c.name,
      v.plate,
      s.name
    into
      v_attendance_id,
      v_attendance_customer,
      v_attendance_plate,
      v_attendance_service
    from public.attendances a
    left join public.customers c on c.id = a.customer_id
    left join public.vehicles v on v.id = a.vehicle_id
    left join public.services s on s.id = a.service_id
    where a.tenant_id = p_tenant_id
      and a.status in ('ready', 'delivered')
      and timezone('America/Sao_Paulo', a.created_at)::date = timezone('America/Sao_Paulo', now())::date
      and (
        (p_identifier_type = 'whatsapp' and regexp_replace(lower(coalesce(c.whatsapp, '')), '\D', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'plate' and regexp_replace(lower(coalesce(v.plate, '')), '[^a-z0-9]', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'customer_name' and lower(coalesce(c.name, '')) like '%' || v_identifier_value || '%')
      )
    order by a.created_at desc
    limit 1;

    if v_attendance_id is null then
      raise exception 'Não encontrei um carro pronto com esse identificador.';
    end if;

    if v_final_description is null then
      v_final_description := coalesce(v_attendance_customer, 'Cliente') || ' • ' || coalesce(v_attendance_plate, 'Sem placa') || ' • ' || coalesce(v_attendance_service, 'Serviço');
    end if;
  end if;

  if v_final_description is null then
    raise exception 'Informe a descrição ou identifique o pagamento.';
  end if;

  insert into public.cash_entries (
    tenant_id,
    cash_session_id,
    attendance_id,
    kind,
    payment_method,
    description,
    amount,
    created_by
  ) values (
    p_tenant_id,
    v_cash_session_id,
    v_attendance_id,
    p_kind,
    p_payment_method,
    v_final_description,
    p_amount,
    auth.uid()
  )
  returning id into v_cash_entry_id;

  if p_kind = 'income' and v_attendance_id is not null and p_payment_method <> 'pending' then
    update public.attendances
    set payment_method = p_payment_method
    where id = v_attendance_id
      and tenant_id = p_tenant_id;
  end if;

  return v_cash_entry_id;
end;
$$;

create or replace function public.close_cash_session_atomic(
  p_tenant_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_cash_income numeric := 0;
  v_cash_expenses numeric := 0;
  v_closing_balance numeric := 0;
begin
  if not public.is_tenant_owner_or_manager(p_tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where tenant_id = p_tenant_id
    and status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if v_session.id is null then
    raise exception 'Não existe caixa aberto.';
  end if;

  select coalesce(sum(amount), 0)
  into v_cash_income
  from public.cash_entries
  where tenant_id = p_tenant_id
    and kind = 'income'
    and payment_method = 'cash'
    and timezone('America/Sao_Paulo', created_at)::date = timezone('America/Sao_Paulo', now())::date;

  select coalesce(sum(amount), 0)
  into v_cash_expenses
  from public.cash_entries
  where tenant_id = p_tenant_id
    and kind = 'expense'
    and coalesce(payment_method, 'cash') = 'cash'
    and timezone('America/Sao_Paulo', created_at)::date = timezone('America/Sao_Paulo', now())::date;

  v_closing_balance := coalesce(v_session.opening_balance, 0) + v_cash_income - v_cash_expenses;

  update public.cash_sessions
  set closed_by = auth.uid(),
      closed_at = timezone('utc', now()),
      closing_balance = v_closing_balance,
      status = 'closed'
  where id = v_session.id
    and tenant_id = p_tenant_id;

  return v_closing_balance;
end;
$$;

create or replace function public.confirm_appointment_atomic(
  p_appointment_id uuid
)
returns table (
  attendance_id uuid,
  public_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_service public.services%rowtype;
  v_minutes integer;
  v_price numeric(10,2);
  v_attendance_id uuid;
  v_public_code text;
begin
  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if v_appointment.id is null or v_appointment.status <> 'scheduled' then
    raise exception 'Agendamento não encontrado.';
  end if;

  if not public.is_tenant_owner_or_manager(v_appointment.tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  select *
  into v_vehicle
  from public.vehicles
  where id = v_appointment.vehicle_id;

  select *
  into v_service
  from public.services
  where id = v_appointment.service_id
    and tenant_id = v_appointment.tenant_id
    and is_active = true;

  if v_appointment.customer_id is null or v_appointment.vehicle_id is null or v_appointment.service_id is null or v_vehicle.vehicle_type is null or v_service.id is null then
    raise exception 'Agendamento incompleto para entrada na fila.';
  end if;

  v_minutes :=
    case
      when v_vehicle.vehicle_type in ('suv', 'pickup_large') then coalesce(v_service.minutes_medio, v_service.average_minutes)
      when v_vehicle.vehicle_type in ('van', 'micro_bus') then coalesce(v_service.minutes_grande, v_service.average_minutes)
      when v_vehicle.vehicle_type in ('truck', 'bus') then coalesce(v_service.minutes_bem_grande, v_service.average_minutes)
      else coalesce(v_service.minutes_passeio, v_service.average_minutes)
    end;

  v_price :=
    case
      when v_vehicle.vehicle_type in ('suv', 'pickup_large') then coalesce(v_service.price_medio, v_service.price)
      when v_vehicle.vehicle_type in ('van', 'micro_bus') then coalesce(v_service.price_grande, v_service.price)
      when v_vehicle.vehicle_type in ('truck', 'bus') then coalesce(v_service.price_bem_grande, v_service.price)
      else coalesce(v_service.price_passeio, v_service.price)
    end;

  insert into public.attendances (
    tenant_id,
    customer_id,
    vehicle_id,
    service_id,
    status,
    estimated_minutes,
    base_price,
    final_price,
    payment_method,
    notify_customer
  ) values (
    v_appointment.tenant_id,
    v_appointment.customer_id,
    v_appointment.vehicle_id,
    v_appointment.service_id,
    'waiting',
    v_minutes,
    v_price,
    v_price,
    'pending',
    false
  )
  returning id, public_code into v_attendance_id, v_public_code;

  insert into public.attendance_public_status (
    attendance_id,
    public_code,
    vehicle_label,
    status,
    eta_minutes,
    step_index,
    is_active
  ) values (
    v_attendance_id,
    v_public_code,
    trim(coalesce(v_vehicle.model, '') || case when v_vehicle.color is not null then ' ' || v_vehicle.color else '' end),
    'waiting',
    v_minutes,
    2,
    true
  )
  on conflict (attendance_id)
  do update set
    public_code = excluded.public_code,
    vehicle_label = excluded.vehicle_label,
    status = excluded.status,
    eta_minutes = excluded.eta_minutes,
    step_index = excluded.step_index,
    is_active = excluded.is_active;

  update public.appointments
  set status = 'completed'
  where id = v_appointment.id
    and tenant_id = v_appointment.tenant_id;

  return query select v_attendance_id, v_public_code;
end;
$$;

grant execute on function public.toggle_employee_presence_atomic(uuid, boolean) to authenticated;
grant execute on function public.mark_daily_payout_paid_atomic(uuid) to authenticated;
grant execute on function public.create_cash_entry_atomic(uuid, public.cash_entry_kind, public.payment_method, text, numeric, text, text) to authenticated;
grant execute on function public.close_cash_session_atomic(uuid) to authenticated;
grant execute on function public.confirm_appointment_atomic(uuid) to authenticated;
