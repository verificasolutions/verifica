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

  if p_kind = 'income'
     and nullif(trim(coalesce(p_identifier_type, '')), '') is not null
     and nullif(trim(coalesce(p_identifier_value, '')), '') is not null then
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
      and (
        (p_identifier_type = 'whatsapp' and regexp_replace(lower(coalesce(c.whatsapp, '')), '\D', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'plate' and regexp_replace(lower(coalesce(v.plate, '')), '[^a-z0-9]', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'customer_name' and lower(coalesce(c.name, '')) like '%' || v_identifier_value || '%')
      )
    order by coalesce(a.ready_at, a.created_at) desc, a.created_at desc
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
