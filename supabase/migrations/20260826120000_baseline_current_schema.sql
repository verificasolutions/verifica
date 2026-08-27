--
-- PostgreSQL database dump
--

\restrict 3R6uwAQ6Hd1rbAKVOvqGqI3oDGEOzN1ncqMG2L4oNKDyZSrOk8pXtUzcsQFzGMe

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'owner',
    'manager',
    'operator'
);


--
-- Name: attendance_media_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_media_kind AS ENUM (
    'entry',
    'step',
    'ready',
    'damage_note',
    'marketing'
);


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'waiting',
    'washing',
    'finishing',
    'ready',
    'delivered',
    'canceled'
);


--
-- Name: cash_entry_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_entry_kind AS ENUM (
    'income',
    'expense'
);


--
-- Name: employee_payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_payment_type AS ENUM (
    'daily',
    'commission',
    'fixed'
);


--
-- Name: operation_box_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.operation_box_kind AS ENUM (
    'entry',
    'wash',
    'dry',
    'finish',
    'ready'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'pix',
    'card',
    'pending'
);


--
-- Name: service_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_kind AS ENUM (
    'main',
    'extra'
);


--
-- Name: award_loyalty_wash(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_loyalty_wash(p_attendance_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_attendance public.attendances%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_total integer;
  v_pos integer;
  v_cycle_start date;
  v_entry_id uuid;
  v_reward_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('loyalty:' || coalesce(p_attendance_id::text, '')));

  select *
  into v_attendance
  from public.attendances
  where id = p_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento não encontrado.';
  end if;

  if v_attendance.status <> 'delivered' then
    raise exception 'Ordem não concluída.';
  end if;

  select *
  into v_program
  from public.loyalty_programs
  where tenant_id = v_attendance.tenant_id
    and is_active = true
  limit 1;

  if v_program.id is null then
    return null; -- tenant sem programa ativo
  end if;

  -- Sem gateway na Fase 2: apenas 'concluded' é atendível; 'concluded_and_paid' fica reservado.
  if v_program.eligibility_rule <> 'concluded' then
    raise exception 'Regra de fidelidade exige pagamento confirmado (não configurado para este tenant).';
  end if;

  -- Idempotência por ordem (uma entrada por attendance).
  if exists (
    select 1 from public.loyalty_entries
    where tenant_id = v_attendance.tenant_id
      and vehicle_id = v_attendance.vehicle_id
      and attendance_id = v_attendance.id
  ) then
    return null;
  end if;

  select count(*)
  into v_total
  from public.loyalty_entries l
  where l.tenant_id = v_attendance.tenant_id
    and l.vehicle_id = v_attendance.vehicle_id
    and l.kind = 'wash'
    and l.attendance_id is not null;

  -- Posição dentro do ciclo: (total_anterior % washes_required) + 1 -> 1..washes_required.
  -- Recompensa SOMENTE na posição final do ciclo (10ª, 20ª, ...), nunca nas seguintes.
  v_pos := (v_total % v_program.washes_required) + 1;

  -- Início do ciclo = data da lavagem mais antiga da janela atual (v_pos-1 anteriores).
  select coalesce(min(sub.event_date)::date, timezone('utc', now())::date)
  into v_cycle_start
  from (
    select l2.event_date
    from public.loyalty_entries l2
    where l2.tenant_id = v_attendance.tenant_id
      and l2.vehicle_id = v_attendance.vehicle_id
      and l2.kind = 'wash'
      and l2.attendance_id is not null
    order by l2.event_date desc, l2.created_at desc
    limit greatest(v_pos - 1, 0)
  ) sub;

  insert into public.loyalty_entries (
    tenant_id, customer_id, vehicle_id, attendance_id, kind,
    wash_number, cycle_started_at, event_date, source, idempotency_key
  ) values (
    v_attendance.tenant_id, v_attendance.customer_id, v_attendance.vehicle_id, v_attendance.id, 'wash',
    v_pos, v_cycle_start, timezone('utc', now()), 'attendance_delivered',
    'loyalty:' || v_attendance.id::text
  )
  on conflict (idempotency_key) do nothing
  returning id into v_entry_id;

  if v_entry_id is null then
    return null;
  end if;

  -- evento auditável atômico (mesma transação da entrada de fidelidade)
  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_attendance.customer_id, 'customer', v_attendance.tenant_id,
    'loyalty.entry.created', 'loyalty_entry', v_entry_id,
    'Lavagem elegível registrada na fidelidade',
    jsonb_build_object('wash_number', v_pos, 'vehicle_id', v_attendance.vehicle_id)
  );

  if v_pos = v_program.washes_required then
    insert into public.loyalty_rewards (
      tenant_id, customer_id, vehicle_id, entry_id, status
    ) values (
      v_attendance.tenant_id, v_attendance.customer_id, v_attendance.vehicle_id, v_entry_id, 'generated'
    )
    returning id into v_reward_id;

    update public.loyalty_rewards
    set status = 'available'
    where id = v_reward_id;
  end if;

  return v_entry_id;
end;
$$;


--
-- Name: claim_attendance_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_attendance_atomic(p_attendance_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_attendance public.attendances%rowtype;
  v_employee_id uuid;
begin
  select *
  into v_attendance
  from public.attendances
  where id = p_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento não encontrado.';
  end if;

  if public.current_tenant_role(v_attendance.tenant_id) <> 'operator' then
    raise exception 'Acesso negado.';
  end if;

  v_employee_id := public.current_employee_id(v_attendance.tenant_id);

  if v_employee_id is null then
    raise exception 'Seu usuário não está vinculado a um funcionário.';
  end if;

  if v_attendance.status <> 'waiting' or v_attendance.employee_id is not null then
    raise exception 'Esse carro não está mais disponível para assumir.';
  end if;

  update public.attendances
  set employee_id = v_employee_id
  where id = v_attendance.id
    and tenant_id = v_attendance.tenant_id;

  return v_attendance.id;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: message_dispatch_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_dispatch_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attendance_id uuid,
    customer_id uuid,
    stage text NOT NULL,
    whatsapp text NOT NULL,
    text text NOT NULL,
    media_url text,
    media_mime_type text,
    media_file_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    processing_started_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_dispatch_queue_stage_check CHECK ((stage = ANY (ARRAY['queue'::text, 'washing'::text, 'finishing'::text, 'ready'::text]))),
    CONSTRAINT message_dispatch_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: claim_message_dispatch_batch(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_message_dispatch_batch(p_limit integer DEFAULT 10) RETURNS SETOF public.message_dispatch_queue
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with picked as (
    select id
    from public.message_dispatch_queue
    where (
      status = 'pending'
      or (status = 'processing' and processing_started_at < now() - interval '2 minutes')
    )
    order by created_at asc
    limit greatest(coalesce(p_limit, 10), 1)
    for update skip locked
  )
  update public.message_dispatch_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      processing_started_at = now(),
      updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
$$;


--
-- Name: close_cash_session_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_cash_session_atomic(p_tenant_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: confirm_appointment_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_appointment_atomic(p_appointment_id uuid) RETURNS TABLE(attendance_id uuid, public_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: create_cash_entry_atomic(uuid, public.cash_entry_kind, public.payment_method, text, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cash_entry_atomic(p_tenant_id uuid, p_kind public.cash_entry_kind, p_payment_method public.payment_method, p_description text, p_amount numeric, p_identifier_type text DEFAULT NULL::text, p_identifier_value text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: create_cash_entry_atomic(uuid, public.cash_entry_kind, public.payment_method, text, numeric, text, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cash_entry_atomic(p_tenant_id uuid, p_kind public.cash_entry_kind, p_payment_method public.payment_method, p_description text, p_amount numeric, p_identifier_type text DEFAULT NULL::text, p_identifier_value text DEFAULT NULL::text, p_effective_date date DEFAULT NULL::date, p_card_kind text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cash_session_id uuid;
  v_attendance_id uuid;
  v_attendance_customer text;
  v_attendance_plate text;
  v_attendance_service text;
  v_final_description text;
  v_identifier_value text;
  v_cash_entry_id uuid;
  v_effective_date date;
  v_settlement_status text;
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

  v_effective_date := coalesce(p_effective_date, timezone('America/Sao_Paulo', now())::date);
  v_settlement_status := case
    when p_payment_method = 'pending' then 'scheduled'
    when v_effective_date > timezone('America/Sao_Paulo', now())::date then 'scheduled'
    else 'settled'
  end;

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
    created_by,
    effective_date,
    settlement_status,
    card_kind
  ) values (
    p_tenant_id,
    case when v_settlement_status = 'settled' then v_cash_session_id else null end,
    v_attendance_id,
    p_kind,
    p_payment_method,
    v_final_description,
    p_amount,
    auth.uid(),
    v_effective_date,
    v_settlement_status,
    nullif(trim(coalesce(p_card_kind, '')), '')
  )
  returning id into v_cash_entry_id;

  if p_kind = 'income' and v_attendance_id is not null and p_payment_method <> 'pending' and v_settlement_status = 'settled' then
    update public.attendances
    set payment_method = p_payment_method
    where id = v_attendance_id
      and tenant_id = p_tenant_id;
  end if;

  return v_cash_entry_id;
end;
$$;


--
-- Name: create_cash_entry_atomic(uuid, public.cash_entry_kind, public.payment_method, text, numeric, uuid, text, text, date, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cash_entry_atomic(p_tenant_id uuid, p_kind public.cash_entry_kind, p_payment_method public.payment_method, p_description text, p_amount numeric, p_attendance_id uuid DEFAULT NULL::uuid, p_identifier_type text DEFAULT NULL::text, p_identifier_value text DEFAULT NULL::text, p_effective_date date DEFAULT NULL::date, p_card_kind text DEFAULT NULL::text, p_mark_delivered boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cash_session_id uuid;
  v_attendance_id uuid;
  v_attendance_status public.attendance_status;
  v_attendance_customer text;
  v_attendance_plate text;
  v_attendance_service text;
  v_final_description text;
  v_identifier_value text;
  v_cash_entry_id uuid;
  v_effective_date date;
  v_settlement_status text;
begin
  if not public.is_tenant_owner_or_manager(p_tenant_id) then
    raise exception 'Acesso negado.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Dados invalidos para lancamento.';
  end if;

  select id
  into v_cash_session_id
  from public.cash_sessions
  where tenant_id = p_tenant_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_cash_session_id is null then
    raise exception 'Abra o caixa antes de registrar movimentacoes.';
  end if;

  v_effective_date := coalesce(p_effective_date, timezone('America/Sao_Paulo', now())::date);
  v_settlement_status := case
    when p_payment_method = 'pending' then 'scheduled'
    when v_effective_date > timezone('America/Sao_Paulo', now())::date then 'scheduled'
    else 'settled'
  end;

  v_final_description := nullif(trim(coalesce(p_description, '')), '');

  if p_kind = 'income' and p_attendance_id is not null then
    select
      a.id,
      a.status,
      c.name,
      v.plate,
      s.name
    into
      v_attendance_id,
      v_attendance_status,
      v_attendance_customer,
      v_attendance_plate,
      v_attendance_service
    from public.attendances a
    left join public.customers c on c.id = a.customer_id
    left join public.vehicles v on v.id = a.vehicle_id
    left join public.services s on s.id = a.service_id
    where a.tenant_id = p_tenant_id
      and a.id = p_attendance_id
      and a.status in ('waiting', 'washing', 'finishing', 'ready', 'delivered')
    limit 1;

    if v_attendance_id is null then
      raise exception 'Nao encontrei esse atendimento para cobranca.';
    end if;
  elsif p_kind = 'income'
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
      a.status,
      c.name,
      v.plate,
      s.name
    into
      v_attendance_id,
      v_attendance_status,
      v_attendance_customer,
      v_attendance_plate,
      v_attendance_service
    from public.attendances a
    left join public.customers c on c.id = a.customer_id
    left join public.vehicles v on v.id = a.vehicle_id
    left join public.services s on s.id = a.service_id
    where a.tenant_id = p_tenant_id
      and a.status in ('waiting', 'washing', 'finishing', 'ready', 'delivered')
      and (
        (p_identifier_type = 'whatsapp' and regexp_replace(lower(coalesce(c.whatsapp, '')), '\D', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'plate' and regexp_replace(lower(coalesce(v.plate, '')), '[^a-z0-9]', '', 'g') like '%' || v_identifier_value || '%')
        or (p_identifier_type = 'customer_name' and lower(coalesce(c.name, '')) like '%' || v_identifier_value || '%')
      )
    order by
      case
        when a.status = 'ready' then 0
        when a.status = 'finishing' then 1
        when a.status = 'washing' then 2
        when a.status = 'waiting' then 3
        else 4
      end,
      coalesce(a.ready_at, a.created_at) desc,
      a.created_at desc
    limit 1;

    if v_attendance_id is null then
      raise exception 'Nao encontrei um atendimento com esse identificador.';
    end if;
  end if;

  if p_kind = 'income' and p_mark_delivered then
    if v_attendance_id is null or v_attendance_status <> 'ready' then
      raise exception 'So e possivel registrar retirada para carro no card de retirada.';
    end if;

    if p_payment_method = 'pending' or v_settlement_status <> 'settled' then
      raise exception 'A retirada exige recebimento confirmado.';
    end if;
  end if;

  if v_final_description is null and v_attendance_id is not null then
    v_final_description := coalesce(v_attendance_customer, 'Cliente') || ' • ' || coalesce(v_attendance_plate, 'Sem placa') || ' • ' || coalesce(v_attendance_service, 'Servico');
  end if;

  if v_final_description is null then
    raise exception 'Informe a descricao ou identifique o pagamento.';
  end if;

  insert into public.cash_entries (
    tenant_id,
    cash_session_id,
    attendance_id,
    kind,
    payment_method,
    description,
    amount,
    created_by,
    effective_date,
    settlement_status,
    card_kind
  ) values (
    p_tenant_id,
    case when v_settlement_status = 'settled' then v_cash_session_id else null end,
    v_attendance_id,
    p_kind,
    p_payment_method,
    v_final_description,
    p_amount,
    auth.uid(),
    v_effective_date,
    v_settlement_status,
    nullif(trim(coalesce(p_card_kind, '')), '')
  )
  returning id into v_cash_entry_id;

  if p_kind = 'income' and v_attendance_id is not null and p_payment_method <> 'pending' and v_settlement_status = 'settled' then
    update public.attendances
    set payment_method = p_payment_method
    where id = v_attendance_id
      and tenant_id = p_tenant_id;
  end if;

  if p_kind = 'income' and v_attendance_id is not null and p_mark_delivered and p_payment_method <> 'pending' and v_settlement_status = 'settled' then
    update public.attendances
    set
      status = 'delivered',
      delivered_at = coalesce(delivered_at, timezone('utc', now()))
    where id = v_attendance_id
      and tenant_id = p_tenant_id
      and status = 'ready';
  end if;

  return v_cash_entry_id;
end;
$$;


--
-- Name: current_employee_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_employee_id(target_tenant_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select e.id
  from public.employees e
  where e.tenant_id = target_tenant_id
    and e.auth_user_id = auth.uid()
    and e.is_active = true
  limit 1;
$$;


--
-- Name: current_tenant_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_role(target_tenant_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select tu.role
  from public.tenant_users tu
  where tu.tenant_id = target_tenant_id
    and tu.user_id = auth.uid()
    and tu.is_active = true
  limit 1;
$$;


--
-- Name: customer_confirm_appointment(text, uuid, uuid[], timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_confirm_appointment(p_token_hash text, p_vehicle_id uuid, p_service_ids uuid[], p_scheduled_for timestamp with time zone, p_idempotency_key uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_customer record;
  v_vehicle public.vehicles%rowtype;
  v_existing public.appointments%rowtype;
  v_appointment public.appointments%rowtype;
  v_intent_id uuid;
  v_payment_mode text;
  v_overrides jsonb;
  v_tier text;
  v_svc record;
  v_pos integer;
  v_dup boolean := false;
  v_main_id uuid;
  v_main_count integer;
  v_extra_count integer;
  v_unit_price numeric;
  v_minutes integer;
  v_total numeric := 0;
  v_estimated integer := 0;
  v_item_index integer := 0;
  v_conflict uuid;
  v_window_end timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('appointment:' || coalesce(p_idempotency_key::text, '')));

  -- sessão válida
  select cc.id as customer_id, cc.tenant_id
  into v_customer
  from public.customer_sessions cs
  join public.customers cc on cc.id = cs.customer_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and cc.is_active = true
  limit 1;

  if v_customer.customer_id is null then
    raise exception 'Sessão inválida ou expirada.';
  end if;

  -- ownership do veículo (tenant/customer vêm da sessão)
  select *
  into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
    and tenant_id = v_customer.tenant_id
    and customer_id = v_customer.customer_id
    and is_active = true;

  if v_vehicle.id is null then
    raise exception 'Veículo inválido.';
  end if;

  -- payload: chave e data/horário revalidados server-side (antes do lock determinístico)
  if p_idempotency_key is null then
    raise exception 'Chave de idempotência obrigatória.';
  end if;

  if p_scheduled_for is null then
    raise exception 'Data e horário obrigatórios.';
  end if;

  -- serialização determinística por tenant+dia: duas confirmações simultâneas no mesmo
  -- intervalo são serializadas; a segunda revalida idempotência e conflito após a primeira.
  perform pg_advisory_xact_lock(
    hashtext('appt-day:' || v_customer.tenant_id::text || ':' || to_char(p_scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
  );

  -- idempotência (após o lock: repetição da MESMA tentativa retorna o agendamento já criado)
  select *
  into v_existing
  from public.appointments
  where tenant_id = v_customer.tenant_id
    and idempotency_key = p_idempotency_key::text
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'appointment_id', v_existing.id,
      'scheduled_for', v_existing.scheduled_for,
      'status', v_existing.status,
      'created', false,
      'payment_intent_id', v_existing.payment_intent_id
    );
  end if;

  if p_scheduled_for <= timezone('utc', now()) then
    raise exception 'Horário deve ser no futuro.';
  end if;

  if p_scheduled_for > timezone('utc', now()) + interval '90 days' then
    raise exception 'Horário muito distante.';
  end if;

  -- serviços: 1 principal + até 3 complementos; ativos; sem duplicatas; complemento do principal
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Serviços inválidos.';
  end if;

  if array_length(p_service_ids, 1) < 1 or array_length(p_service_ids, 1) > 4 then
    raise exception 'Selecione 1 serviço principal e até 3 complementos.';
  end if;

  select count(*) <> array_length(p_service_ids, 1)
  into v_dup
  from unnest(p_service_ids) t(id)
  group by t.id
  having count(*) > 1
  limit 1;

  if v_dup then
    raise exception 'Serviços duplicados.';
  end if;

  -- modo de pagamento configurado (sem gateway nesta fase)
  select payment_mode into v_payment_mode
  from public.tenant_settings
  where tenant_id = v_customer.tenant_id;

  if v_payment_mode is null then
    v_payment_mode := 'order_without_online_payment';
  end if;

  if v_payment_mode <> 'order_without_online_payment' then
    raise exception 'Modo de pagamento online ainda não configurado para este tenant.';
  end if;

  -- porte do veículo (motor interno + overrides)
  select coalesce(vehicle_type_tier_overrides, '{}'::jsonb)
  into v_overrides
  from public.tenant_settings
  where tenant_id = v_customer.tenant_id;

  if v_overrides is null then
    v_overrides := '{}'::jsonb;
  end if;

  v_tier := coalesce(v_vehicle.size_tier, public.resolve_vehicle_size_tier(v_vehicle.vehicle_type, v_overrides));

  -- catálogo: 1 main + extras válidos
  select count(*) filter (where s.kind = 'main'),
         count(*) filter (where s.kind = 'extra')
  into v_main_count, v_extra_count
  from public.services s
  where s.tenant_id = v_customer.tenant_id
    and s.id = any(p_service_ids)
    and s.is_active = true;

  if v_main_count + v_extra_count <> array_length(p_service_ids, 1) then
    raise exception 'Serviço inválido ou inativo.';
  end if;

  if v_main_count <> 1 then
    raise exception 'Selecione exatamente 1 serviço principal.';
  end if;

  if v_extra_count > 3 then
    raise exception 'Máximo de 3 complementos.';
  end if;

  select id into v_main_id
  from public.services
  where tenant_id = v_customer.tenant_id
    and id = any(p_service_ids)
    and kind = 'main'
    and is_active = true
  limit 1;

  -- preço/duração server-side (semântica 0 = não configurado, como na ordem)
  for v_pos in 1 .. array_length(p_service_ids, 1) loop
    select *
    into v_svc
    from public.services
    where tenant_id = v_customer.tenant_id
      and id = p_service_ids[v_pos]
      and is_active = true;

    if v_svc.kind = 'extra' and v_svc.base_service_id is not null and v_svc.base_service_id <> v_main_id then
      raise exception 'Complemento não pertence ao serviço selecionado.';
    end if;

    if v_svc.kind = 'main' then
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.minutes_medio, 0), v_svc.average_minutes)
        when 'grande' then coalesce(nullif(v_svc.minutes_grande, 0), v_svc.average_minutes)
        when 'bem_grande' then coalesce(nullif(v_svc.minutes_bem_grande, 0), v_svc.average_minutes)
        else coalesce(nullif(v_svc.minutes_passeio, 0), v_svc.average_minutes)
      end;
    else
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_price_app_medio, 0), nullif(v_svc.addon_price_medio, 0), nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.addon_price_app_grande, 0), nullif(v_svc.addon_price_grande, 0), nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_price_app_bem_grande, 0), nullif(v_svc.addon_price_bem_grande, 0), nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.addon_price_app_passeio, 0), nullif(v_svc.addon_price_passeio, 0), nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_minutes_medio, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'grande' then coalesce(nullif(v_svc.addon_minutes_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_minutes_bem_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        else coalesce(nullif(v_svc.addon_minutes_passeio, 0), nullif(v_svc.addon_minutes, 0), 0)
      end;
    end if;

    v_total := v_total + coalesce(v_unit_price, 0);
    v_estimated := v_estimated + coalesce(v_minutes, 0);
  end loop;

  -- disponibilidade/conflito de horário DENTRO da transação
  v_window_end := p_scheduled_for + make_interval(mins => greatest(v_estimated, 1));

  select a.id
  into v_conflict
  from public.appointments a
  where a.tenant_id = v_customer.tenant_id
    and a.status in ('scheduled', 'confirmed')
    and a.scheduled_for < v_window_end
    and a.scheduled_for + make_interval(mins => coalesce(
      (select sum(ai.estimated_minutes)::integer from public.appointment_items ai where ai.appointment_id = a.id), 0)
    ) > p_scheduled_for
  limit 1;

  if v_conflict is not null then
    raise exception 'Horário indisponível para este período.';
  end if;

  -- intent not_required (sem gateway)
  insert into public.payment_intents (
    tenant_id, customer_id, attendance_id, appointment_id, amount, status, payment_method,
    idempotency_key, metadata
  ) values (
    v_customer.tenant_id, v_customer.customer_id, null, null, v_total, 'not_required', null,
    'appt:' || p_idempotency_key::text,
    jsonb_build_object('mode', v_payment_mode, 'vehicle_id', p_vehicle_id, 'tier', v_tier)
  )
  returning id into v_intent_id;

  -- agendamento (uma única confirmação)
  insert into public.appointments (
    tenant_id, customer_id, vehicle_id, service_id, scheduled_for, notes, status,
    total_price, idempotency_key, payment_intent_id
  ) values (
    v_customer.tenant_id, v_customer.customer_id, v_vehicle.id, null, p_scheduled_for, null, 'scheduled',
    v_total, p_idempotency_key::text, v_intent_id
  )
  returning * into v_appointment;

  update public.payment_intents
  set appointment_id = v_appointment.id,
      updated_at = timezone('utc', now())
  where id = v_intent_id;

  -- snapshot dos itens (preço/duração calculados no servidor)
  for v_pos in 1 .. array_length(p_service_ids, 1) loop
    select *
    into v_svc
    from public.services
    where tenant_id = v_customer.tenant_id
      and id = p_service_ids[v_pos]
      and is_active = true;

    if v_svc.kind = 'main' then
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.minutes_medio, 0), v_svc.average_minutes)
        when 'grande' then coalesce(nullif(v_svc.minutes_grande, 0), v_svc.average_minutes)
        when 'bem_grande' then coalesce(nullif(v_svc.minutes_bem_grande, 0), v_svc.average_minutes)
        else coalesce(nullif(v_svc.minutes_passeio, 0), v_svc.average_minutes)
      end;
    else
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_price_app_medio, 0), nullif(v_svc.addon_price_medio, 0), nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.addon_price_app_grande, 0), nullif(v_svc.addon_price_grande, 0), nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_price_app_bem_grande, 0), nullif(v_svc.addon_price_bem_grande, 0), nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.addon_price_app_passeio, 0), nullif(v_svc.addon_price_passeio, 0), nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_minutes_medio, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'grande' then coalesce(nullif(v_svc.addon_minutes_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_minutes_bem_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        else coalesce(nullif(v_svc.addon_minutes_passeio, 0), nullif(v_svc.addon_minutes, 0), 0)
      end;
    end if;

    v_item_index := v_item_index + 1;

    insert into public.appointment_items (
      tenant_id, appointment_id, service_id, name, unit_price, estimated_minutes,
      sort_order, is_primary
    ) values (
      v_appointment.tenant_id, v_appointment.id, v_svc.id, v_svc.name, v_unit_price, v_minutes,
      v_item_index, v_item_index = 1
    );
  end loop;

  -- evento auditável ATÔMICO (mesma transação do agendamento)
  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.customer_id, 'customer', v_customer.tenant_id,
    'appointment.created', 'appointment', v_appointment.id,
    'Agendamento criado pelo portal',
    jsonb_build_object('scheduled_for', p_scheduled_for, 'total_price', v_total)
  );

  return jsonb_build_object(
    'appointment_id', v_appointment.id,
    'scheduled_for', v_appointment.scheduled_for,
    'status', v_appointment.status,
    'created', true,
    'payment_intent_id', v_intent_id,
    'total_price', v_total,
    'estimated_minutes', v_estimated,
    'items', v_item_index
  );
end;
$$;


--
-- Name: customer_confirm_order(text, uuid, uuid[], uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_confirm_order(p_token_hash text, p_vehicle_id uuid, p_service_ids uuid[], p_idempotency_key uuid, p_reward_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_customer record;
  v_vehicle public.vehicles%rowtype;
  v_existing public.attendances%rowtype;
  v_attendance public.attendances%rowtype;
  v_intent_id uuid;
  v_entry_box public.operation_boxes%rowtype;
  v_queue_position integer;
  v_payment_mode text;
  v_overrides jsonb;
  v_tier text;
  v_svc record;
  v_pos integer;
  v_dup boolean := false;
  v_main_id uuid;
  v_main_count integer;
  v_extra_count integer;
  v_unit_price numeric;
  v_minutes integer;
  v_catalog_total numeric := 0;
  v_estimated integer := 0;
  v_item_index integer := 0;
  v_reward public.loyalty_rewards%rowtype;
  v_free boolean := false;
  v_final_price numeric;
  v_vehicle_label text;
begin
  perform pg_advisory_xact_lock(hashtext('order:' || coalesce(p_idempotency_key::text, '')));

  -- 1) sessão válida
  select cc.id as customer_id, cc.tenant_id, cc.name
  into v_customer
  from public.customer_sessions cs
  join public.customers cc on cc.id = cs.customer_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and cc.is_active = true
  limit 1;

  if v_customer.customer_id is null then
    raise exception 'Sessão inválida ou expirada.';
  end if;

  -- 2) propriedade do veículo (tenant_id + customer_id vêm da sessão)
  select *
  into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
    and tenant_id = v_customer.tenant_id
    and customer_id = v_customer.customer_id
    and is_active = true;

  if v_vehicle.id is null then
    raise exception 'Veículo inválido.';
  end if;

  -- 3) idempotência: repetição da mesma tentativa retorna a ordem já criada
  select *
  into v_existing
  from public.attendances
  where tenant_id = v_customer.tenant_id
    and idempotency_key = p_idempotency_key::text
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'attendance_id', v_existing.id,
      'public_code', v_existing.public_code,
      'status', v_existing.status,
      'created', false,
      'payment_intent_id', v_existing.payment_intent_id
    );
  end if;

  -- 4) validação dos IDs (até 4 serviços, sendo no máximo 3 complementos; sem duplicatas)
  if p_idempotency_key is null then
    raise exception 'Chave de idempotência obrigatória.';
  end if;

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Serviços inválidos.';
  end if;

  if array_length(p_service_ids, 1) < 1 or array_length(p_service_ids, 1) > 4 then
    raise exception 'Selecione 1 serviço principal e até 3 complementos.';
  end if;

  select count(*) <> array_length(p_service_ids, 1)
  into v_dup
  from unnest(p_service_ids) t(id)
  group by t.id
  having count(*) > 1
  limit 1;

  if v_dup then
    raise exception 'Serviços duplicados.';
  end if;

  -- 5) modo de pagamento configurado (primeiro tenant: sem gateway)
  select payment_mode into v_payment_mode
  from public.tenant_settings
  where tenant_id = v_customer.tenant_id;

  if v_payment_mode is null then
    v_payment_mode := 'order_without_online_payment';
  end if;

  if v_payment_mode <> 'order_without_online_payment' then
    raise exception 'Modo de pagamento online ainda não configurado para este tenant.';
  end if;

  -- 6) porte do veículo (motor interno + overrides do tenant)
  select coalesce(vehicle_type_tier_overrides, '{}'::jsonb)
  into v_overrides
  from public.tenant_settings
  where tenant_id = v_customer.tenant_id;

  if v_overrides is null then
    v_overrides := '{}'::jsonb;
  end if;

  v_tier := coalesce(v_vehicle.size_tier, public.resolve_vehicle_size_tier(v_vehicle.vehicle_type, v_overrides));

  -- 7) validação do catálogo e cálculo server-side de preço/duração
  select count(*) filter (where s.kind = 'main'),
         count(*) filter (where s.kind = 'extra')
  into v_main_count, v_extra_count
  from public.services s
  where s.tenant_id = v_customer.tenant_id
    and s.id = any(p_service_ids)
    and s.is_active = true;

  if v_main_count + v_extra_count <> array_length(p_service_ids, 1) then
    raise exception 'Serviço inválido ou inativo.';
  end if;

  if v_main_count < 1 then
    raise exception 'Selecione ao menos 1 serviço principal.';
  end if;

  if v_extra_count > 3 then
    raise exception 'Máximo de 3 complementos.';
  end if;

  select id into v_main_id
  from public.services
  where tenant_id = v_customer.tenant_id
    and id = any(p_service_ids)
    and kind = 'main'
    and is_active = true
  limit 1;

  for v_pos in 1 .. array_length(p_service_ids, 1) loop
    select *
    into v_svc
    from public.services
    where tenant_id = v_customer.tenant_id
      and id = p_service_ids[v_pos]
      and is_active = true;

    -- complemento deve pertencer ao serviço principal (ou ser independente)
    if v_svc.kind = 'extra' and v_svc.base_service_id is not null and v_svc.base_service_id <> v_main_id then
      raise exception 'Complemento não pertence ao serviço selecionado.';
    end if;

    if v_svc.kind = 'main' then
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.minutes_medio, 0), v_svc.average_minutes)
        when 'grande' then coalesce(nullif(v_svc.minutes_grande, 0), v_svc.average_minutes)
        when 'bem_grande' then coalesce(nullif(v_svc.minutes_bem_grande, 0), v_svc.average_minutes)
        else coalesce(nullif(v_svc.minutes_passeio, 0), v_svc.average_minutes)
      end;
    else
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_price_app_medio, 0), nullif(v_svc.addon_price_medio, 0), nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.addon_price_app_grande, 0), nullif(v_svc.addon_price_grande, 0), nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_price_app_bem_grande, 0), nullif(v_svc.addon_price_bem_grande, 0), nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.addon_price_app_passeio, 0), nullif(v_svc.addon_price_passeio, 0), nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_minutes_medio, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'grande' then coalesce(nullif(v_svc.addon_minutes_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_minutes_bem_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        else coalesce(nullif(v_svc.addon_minutes_passeio, 0), nullif(v_svc.addon_minutes, 0), 0)
      end;
    end if;

    v_catalog_total := v_catalog_total + coalesce(v_unit_price, 0);
    v_estimated := v_estimated + coalesce(v_minutes, 0);
  end loop;

  -- 8) recompensa de fidelidade opcional (lavagem gratuita daquele veículo)
  v_final_price := v_catalog_total;

  if p_reward_id is not null then
    select *
    into v_reward
    from public.loyalty_rewards
    where id = p_reward_id
      and tenant_id = v_customer.tenant_id
      and vehicle_id = p_vehicle_id
      and status = 'available'
    for update;

    if v_reward.id is null then
      raise exception 'Recompensa indisponível para este veículo.';
    end if;

    v_free := true;
    v_final_price := 0;
  end if;

  -- 9) payment intent (modo atual: not_required; ordem não depende do status)
  insert into public.payment_intents (
    tenant_id, customer_id, attendance_id, amount, status, payment_method,
    idempotency_key, metadata
  ) values (
    v_customer.tenant_id, v_customer.customer_id, null, v_final_price, 'not_required', null,
    'order:' || p_idempotency_key::text,
    jsonb_build_object('mode', v_payment_mode, 'vehicle_id', p_vehicle_id, 'tier', v_tier)
  )
  returning id into v_intent_id;

  -- 10) criação da ordem (uma única; status waiting; nunca marcada paga)
  insert into public.attendances (
    tenant_id, customer_id, vehicle_id, service_id, service_label,
    status, estimated_minutes, base_price, final_price, payment_method,
    idempotency_key, source, payment_intent_id, notify_customer
  ) values (
    v_customer.tenant_id, v_customer.customer_id, v_vehicle.id,
    null, null,
    'waiting', v_estimated, v_catalog_total, v_final_price, 'pending',
    p_idempotency_key::text, 'portal', v_intent_id, false
  )
  returning * into v_attendance;

  -- 10b) vínculo transacional bidirecional: payment_intents.attendance_id <- ordem criada
  update public.payment_intents
  set attendance_id = v_attendance.id,
      updated_at = timezone('utc', now())
  where id = v_intent_id;

  -- 11) itens da ordem (snapshot calculado no servidor)
  for v_pos in 1 .. array_length(p_service_ids, 1) loop
    select *
    into v_svc
    from public.services
    where tenant_id = v_customer.tenant_id
      and id = p_service_ids[v_pos]
      and is_active = true;

    if v_svc.kind = 'main' then
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.minutes_medio, 0), v_svc.average_minutes)
        when 'grande' then coalesce(nullif(v_svc.minutes_grande, 0), v_svc.average_minutes)
        when 'bem_grande' then coalesce(nullif(v_svc.minutes_bem_grande, 0), v_svc.average_minutes)
        else coalesce(nullif(v_svc.minutes_passeio, 0), v_svc.average_minutes)
      end;
    else
      v_unit_price := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_price_app_medio, 0), nullif(v_svc.addon_price_medio, 0), nullif(v_svc.price_app_medio, 0), nullif(v_svc.price_medio, 0), v_svc.price)
        when 'grande' then coalesce(nullif(v_svc.addon_price_app_grande, 0), nullif(v_svc.addon_price_grande, 0), nullif(v_svc.price_app_grande, 0), nullif(v_svc.price_grande, 0), v_svc.price)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_price_app_bem_grande, 0), nullif(v_svc.addon_price_bem_grande, 0), nullif(v_svc.price_app_bem_grande, 0), nullif(v_svc.price_bem_grande, 0), v_svc.price)
        else coalesce(nullif(v_svc.addon_price_app_passeio, 0), nullif(v_svc.addon_price_passeio, 0), nullif(v_svc.price_app_passeio, 0), nullif(v_svc.price_passeio, 0), v_svc.price)
      end;
      v_minutes := case v_tier
        when 'medio' then coalesce(nullif(v_svc.addon_minutes_medio, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'grande' then coalesce(nullif(v_svc.addon_minutes_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        when 'bem_grande' then coalesce(nullif(v_svc.addon_minutes_bem_grande, 0), nullif(v_svc.addon_minutes, 0), 0)
        else coalesce(nullif(v_svc.addon_minutes_passeio, 0), nullif(v_svc.addon_minutes, 0), 0)
      end;
    end if;

    v_item_index := v_item_index + 1;

    insert into public.attendance_service_items (
      tenant_id, attendance_id, service_id, name, estimated_minutes, unit_price,
      status, sort_order, is_primary
    ) values (
      v_attendance.tenant_id, v_attendance.id, v_svc.id, v_svc.name, v_minutes,
      case when v_free then 0 else v_unit_price end,
      'pending', v_item_index, v_item_index = 1
    );
  end loop;

  -- 12) status público de acompanhamento
  v_vehicle_label := trim(coalesce(v_vehicle.brand, '') || ' ' || coalesce(v_vehicle.model, ''));
  if v_vehicle_label = '' then
    v_vehicle_label := 'Veículo';
  end if;
  if v_vehicle.color is not null and v_vehicle.color <> '' then
    v_vehicle_label := v_vehicle_label || ' ' || v_vehicle.color;
  end if;

  insert into public.attendance_public_status (
    attendance_id, public_code, vehicle_label, status, eta_minutes, step_index, is_active
  ) values (
    v_attendance.id, v_attendance.public_code, v_vehicle_label,
    'waiting', v_estimated, 2, true
  );

  -- 13) entrada imediata no grid/box operacional (comportamento de create-attendance.ts)
  select *
  into v_entry_box
  from public.operation_boxes
  where tenant_id = v_attendance.tenant_id
    and kind = 'entry'::public.operation_box_kind
    and is_active = true
  order by sort_order
  limit 1;

  if v_entry_box.id is null then
    select *
    into v_entry_box
    from public.operation_boxes
    where tenant_id = v_attendance.tenant_id
      and is_active = true
    order by sort_order
    limit 1;
  end if;

  if v_entry_box.id is not null then
    select coalesce(max(queue_position), 0) + 1
    into v_queue_position
    from public.attendances
    where tenant_id = v_attendance.tenant_id
      and status = 'waiting'::public.attendance_status;

    update public.attendances
    set current_box_id = v_entry_box.id,
        queue_position = v_queue_position,
        operational_stage = v_entry_box.kind::text,
        status = 'waiting'::public.attendance_status
    where id = v_attendance.id;

    insert into public.attendance_box_events (
      tenant_id, attendance_id, from_box_id, to_box_id, moved_by, note
    ) values (
      v_attendance.tenant_id, v_attendance.id, null, v_entry_box.id, null,
      'Entrada inicial do atendimento (portal)'
    );
  end if;

  -- 14) consumo da recompensa na mesma transação (se aplicável)
  if v_reward.id is not null then
    update public.loyalty_rewards
    set status = 'used',
        used_attendance_id = v_attendance.id,
        used_at = timezone('utc', now())
    where id = v_reward.id;
  end if;

  -- 15) evento auditável ATÔMICO (mesma transação da ordem — nunca ordem sem audit_log)
  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.customer_id, 'customer', v_customer.tenant_id,
    'order.created', 'attendance', v_attendance.id,
    'Pedido criado pelo portal',
    jsonb_build_object(
      'public_code', v_attendance.public_code,
      'final_price', v_final_price,
      'idempotency_key', p_idempotency_key::text
    )
  );

  return jsonb_build_object(
    'attendance_id', v_attendance.id,
    'public_code', v_attendance.public_code,
    'status', v_attendance.status,
    'created', true,
    'payment_intent_id', v_intent_id,
    'final_price', v_final_price,
    'catalog_total', v_catalog_total,
    'estimated_minutes', v_estimated,
    'items', v_item_index
  );
end;
$$;


--
-- Name: customer_current(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_current(p_token_hash text) RETURNS TABLE(customer_id uuid, tenant_id uuid, name text, phone_normalized text, tenant_slug text, tenant_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select c.id, c.tenant_id, c.name, c.phone_normalized, t.slug, t.name
  from public.customer_sessions cs
  join public.customers c on c.id = cs.customer_id
  join public.tenants t on t.id = c.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and c.is_active = true
    and t.is_active = true;
$$;


--
-- Name: customer_link_vehicle(text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_link_vehicle(p_token_hash text, p_plate text, p_brand text, p_model text, p_color text, p_vehicle_type text, p_usage_type text, p_size_tier text, p_tier_source text, p_vehicle_source text) RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, plate text, brand text, model text, color text, vehicle_type text, usage_type text, size_tier text, tier_source text, vehicle_source text, confirmed_at timestamp with time zone, last_vehicle_data_at timestamp with time zone, is_active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_customer record;
  v_vehicle public.vehicles%rowtype;
  v_plate text;
begin
  select cc.id as customer_id, cc.tenant_id
  into v_customer
  from public.customer_sessions cs
  join public.customers cc on cc.id = cs.customer_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and cc.is_active = true
  limit 1;

  if v_customer.customer_id is null then
    raise exception 'Sessão inválida ou expirada.';
  end if;

  v_plate := upper(regexp_replace(coalesce(p_plate, ''), '[^A-Za-z0-9]+', '', 'g'));

  if v_plate = '' then
    raise exception 'Placa obrigatória.';
  end if;

  select *
  into v_vehicle
  from public.vehicles
  where vehicles.tenant_id = v_customer.tenant_id
    and vehicles.plate = v_plate
  limit 1;

  if v_vehicle.id is not null and v_vehicle.customer_id <> v_customer.customer_id then
    raise exception 'Placa já vinculada a outro cliente deste tenant.';
  end if;

  if v_vehicle.id is null then
    insert into public.vehicles (
      tenant_id, customer_id, plate, brand, model, color, vehicle_type,
      usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active
    ) values (
      v_customer.tenant_id, v_customer.customer_id, v_plate,
      nullif(p_brand, ''), coalesce(nullif(p_model, ''), 'Veículo'), nullif(p_color, ''),
      nullif(p_vehicle_type, ''), coalesce(nullif(p_usage_type, ''), 'particular'),
      nullif(p_size_tier, ''), nullif(p_tier_source, ''),
      coalesce(nullif(p_vehicle_source, ''), 'portal'),
      timezone('utc', now()), timezone('utc', now()), true
    )
    returning * into v_vehicle;
  else
    update public.vehicles
    set brand = coalesce(nullif(p_brand, ''), brand),
        model = coalesce(nullif(p_model, ''), model),
        color = coalesce(nullif(p_color, ''), color),
        vehicle_type = coalesce(nullif(p_vehicle_type, ''), vehicle_type),
        usage_type = coalesce(nullif(p_usage_type, ''), usage_type),
        size_tier = coalesce(nullif(p_size_tier, ''), size_tier),
        tier_source = coalesce(nullif(p_tier_source, ''), tier_source),
        vehicle_source = coalesce(nullif(p_vehicle_source, ''), vehicle_source),
        confirmed_at = coalesce(confirmed_at, timezone('utc', now())),
        last_vehicle_data_at = timezone('utc', now()),
        is_active = true
    where id = v_vehicle.id
    returning * into v_vehicle;
  end if;

  -- evento auditável atômico (mesma transação do vínculo)
  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.customer_id, 'customer', v_customer.tenant_id,
    'vehicle.linked', 'vehicle', v_vehicle.id,
    'Veículo vinculado pelo portal', jsonb_build_object('plate', v_vehicle.plate)
  );

  return query
    select v_vehicle.id, v_vehicle.tenant_id, v_vehicle.customer_id, v_vehicle.plate,
           v_vehicle.brand, v_vehicle.model, v_vehicle.color, v_vehicle.vehicle_type,
           v_vehicle.usage_type, v_vehicle.size_tier, v_vehicle.tier_source,
           v_vehicle.vehicle_source, v_vehicle.confirmed_at, v_vehicle.last_vehicle_data_at,
           v_vehicle.is_active;
end;
$$;


--
-- Name: customer_list_services(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_list_services(p_token_hash text) RETURNS TABLE(id uuid, name text, short_description text, kind public.service_kind, base_service_id uuid, sort_order integer, price numeric, price_passeio numeric, price_medio numeric, price_grande numeric, price_bem_grande numeric, price_app_passeio numeric, price_app_medio numeric, price_app_grande numeric, price_app_bem_grande numeric, addon_price_passeio numeric, addon_price_medio numeric, addon_price_grande numeric, addon_price_bem_grande numeric, addon_price_app_passeio numeric, addon_price_app_medio numeric, addon_price_app_grande numeric, addon_price_app_bem_grande numeric, minutes_passeio integer, minutes_medio integer, minutes_grande integer, minutes_bem_grande integer, addon_minutes integer, addon_minutes_passeio integer, addon_minutes_medio integer, addon_minutes_grande integer, addon_minutes_bem_grande integer, average_minutes integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select s.id, s.name, s.short_description, s.kind, s.base_service_id, s.sort_order,
         s.price, s.price_passeio, s.price_medio, s.price_grande, s.price_bem_grande,
         s.price_app_passeio, s.price_app_medio, s.price_app_grande, s.price_app_bem_grande,
         s.addon_price_passeio, s.addon_price_medio, s.addon_price_grande, s.addon_price_bem_grande,
         s.addon_price_app_passeio, s.addon_price_app_medio, s.addon_price_app_grande, s.addon_price_app_bem_grande,
         s.minutes_passeio, s.minutes_medio, s.minutes_grande, s.minutes_bem_grande,
         s.addon_minutes, s.addon_minutes_passeio, s.addon_minutes_medio, s.addon_minutes_grande, s.addon_minutes_bem_grande,
         s.average_minutes
  from public.services s
  join public.customer_sessions cs on cs.tenant_id = s.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and s.is_active = true
  order by s.sort_order, s.name;
$$;


--
-- Name: customer_list_vehicles(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_list_vehicles(p_token_hash text) RETURNS TABLE(id uuid, tenant_id uuid, customer_id uuid, plate text, brand text, model text, color text, vehicle_type text, usage_type text, size_tier text, tier_source text, vehicle_source text, confirmed_at timestamp with time zone, last_vehicle_data_at timestamp with time zone, is_active boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select v.id, v.tenant_id, v.customer_id, v.plate, v.brand, v.model, v.color,
         v.vehicle_type, v.usage_type, v.size_tier, v.tier_source, v.vehicle_source,
         v.confirmed_at, v.last_vehicle_data_at, v.is_active
  from public.vehicles v
  join public.customer_sessions cs
    on cs.customer_id = v.customer_id
   and cs.tenant_id = v.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and v.is_active = true
  order by v.created_at;
$$;


--
-- Name: customer_loyalty_summary(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_loyalty_summary(p_token_hash text, p_vehicle_id uuid) RETURNS TABLE(program_id uuid, washes_required integer, washes_completed integer, reward_id uuid, reward_status text, reward_used_at timestamp with time zone, cycle_started_at date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select
    lp.id,
    lp.washes_required,
    coalesce((
      select count(*)::integer
      from public.loyalty_entries le
      where le.tenant_id = v.tenant_id
        and le.vehicle_id = v.id
        and le.kind = 'wash'
    ), 0),
    (
      select lr.id
      from public.loyalty_rewards lr
      where lr.tenant_id = v.tenant_id
        and lr.vehicle_id = v.id
        and lr.status in ('generated', 'available')
      order by lr.created_at desc
      limit 1
    ),
    (
      select lr.status
      from public.loyalty_rewards lr
      where lr.tenant_id = v.tenant_id
        and lr.vehicle_id = v.id
        and lr.status in ('generated', 'available')
      order by lr.created_at desc
      limit 1
    ),
    (
      select lr.used_at
      from public.loyalty_rewards lr
      where lr.tenant_id = v.tenant_id
        and lr.vehicle_id = v.id
        and lr.status in ('generated', 'available')
      order by lr.created_at desc
      limit 1
    ),
    (
      select min(le2.event_date)::date
      from public.loyalty_entries le2
      where le2.tenant_id = v.tenant_id
        and le2.vehicle_id = v.id
        and le2.kind = 'wash'
    )
  from public.loyalty_programs lp
  join public.vehicles v
    on v.id = p_vehicle_id
   and v.tenant_id = lp.tenant_id
   and v.is_active = true
  join public.customer_sessions cs
    on cs.customer_id = v.customer_id
   and cs.tenant_id = v.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and lp.is_active = true
  limit 1;
$$;


--
-- Name: customer_order_draft_create(uuid, uuid, uuid, text, uuid[], uuid, uuid, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_order_draft_create(p_tenant_id uuid, p_customer_id uuid, p_vehicle_id uuid, p_kind text, p_service_ids uuid[], p_reward_id uuid, p_idempotency_key uuid, p_session_token_hash text, p_expires_at timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_draft_id uuid;
begin
  if p_kind not in ('order', 'appointment') then
    raise exception 'Tipo de draft inválido.';
  end if;

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Serviços inválidos.';
  end if;

  insert into public.customer_order_drafts (
    tenant_id, customer_id, vehicle_id, kind, service_ids, reward_id,
    idempotency_key, session_token_hash, status, expires_at
  ) values (
    p_tenant_id, p_customer_id, p_vehicle_id, p_kind, p_service_ids, p_reward_id,
    p_idempotency_key, p_session_token_hash, 'open', p_expires_at
  )
  returning id into v_draft_id;

  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, p_customer_id, 'customer', p_tenant_id,
    case when p_kind = 'appointment' then 'appointment.draft.created' else 'order.draft.created' end,
    'order_draft', v_draft_id,
    'Tentativa de contratação criada pelo cliente', '{}'::jsonb
  );

  return v_draft_id;
end;
$$;


--
-- Name: customer_orders(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_orders(p_token_hash text, p_vehicle_id uuid) RETURNS TABLE(id uuid, tenant_id uuid, vehicle_id uuid, status text, public_code text, estimated_minutes integer, created_at timestamp with time zone, service_summary text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select
    a.id, a.tenant_id, a.vehicle_id, a.status::text, a.public_code,
    a.estimated_minutes, a.created_at,
    coalesce(
      a.service_label,
      (select asi.name from public.attendance_service_items asi
        where asi.attendance_id = a.id and asi.is_primary limit 1),
      ''
    ) as service_summary
  from public.attendances a
  join public.vehicles v
    on v.id = p_vehicle_id
   and v.tenant_id = a.tenant_id
   and v.customer_id = a.customer_id
   and v.is_active = true
  join public.customer_sessions cs
    on cs.customer_id = a.customer_id
   and cs.tenant_id = a.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and a.vehicle_id = v.id
  order by a.created_at desc;
$$;


--
-- Name: customer_payment_intents(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_payment_intents(p_token_hash text) RETURNS TABLE(id uuid, tenant_id uuid, attendance_id uuid, amount numeric, status text, payment_method text, created_at timestamp with time zone, succeeded_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select pi.id, pi.tenant_id, pi.attendance_id, pi.amount, pi.status,
         pi.payment_method, pi.created_at, pi.succeeded_at
  from public.payment_intents pi
  join public.customer_sessions cs
    on cs.customer_id = pi.customer_id
   and cs.tenant_id = pi.tenant_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now());
$$;


--
-- Name: customer_register(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_register(p_entry_token_hash text, p_name text, p_password_hash text) RETURNS TABLE(id uuid, tenant_id uuid, name text, phone_normalized text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  v_token public.entry_tokens%rowtype;
  v_customer public.customers%rowtype;
begin
  if p_entry_token_hash is null or p_name is null or btrim(p_name) = '' then
    raise exception 'Dados inválidos.';
  end if;

  -- hash produzido SOMENTE no servidor (scrypt); senha em texto nunca chega a esta função
  if p_password_hash is null or p_password_hash = '' or p_password_hash !~ '^scrypt\$' then
    raise exception 'Hash de senha inválido.';
  end if;

  -- valida e consome o entry token de forma atômica (uso único, não expirado)
  update public.entry_tokens
  set consumed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where token_hash = p_entry_token_hash
    and consumed_at is null
    and expires_at > timezone('utc', now())
  returning * into v_token;

  if v_token.id is null then
    raise exception 'Token de entrada inválido ou expirado.';
  end if;

  if not exists (select 1 from public.tenants t where t.id = v_token.tenant_id and t.is_active = true) then
    raise exception 'Tenant inválido.';
  end if;

  -- cliente + credencial + auditoria na mesma transação (nenhum customer sem credential)
  insert into public.customers (tenant_id, name, whatsapp, phone_normalized, is_active)
  values (v_token.tenant_id, btrim(p_name), v_token.phone_normalized, v_token.phone_normalized, true)
  returning * into v_customer;

  insert into public.customer_credentials (customer_id, tenant_id, password_hash)
  values (v_customer.id, v_customer.tenant_id, p_password_hash);

  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.id, 'customer', v_customer.tenant_id,
    'customer.register', 'customer', v_customer.id,
    'Cliente registrado pelo portal', '{}'::jsonb
  );

  return query select v_customer.id, v_customer.tenant_id, v_customer.name, v_customer.phone_normalized;
end;
$_$;


--
-- Name: customer_session_create_log(uuid, uuid, text, timestamp with time zone, inet, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_session_create_log(p_tenant_id uuid, p_customer_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_created_ip inet, p_user_agent text, p_entry_token_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_session_id uuid;
begin
  if p_tenant_id is null or p_customer_id is null or p_token_hash is null or p_expires_at is null then
    raise exception 'Dados de sessão inválidos.';
  end if;

  insert into public.customer_sessions (customer_id, tenant_id, token_hash, expires_at, created_ip, user_agent)
  values (p_customer_id, p_tenant_id, p_token_hash, p_expires_at, p_created_ip, p_user_agent)
  returning id into v_session_id;

  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, p_customer_id, 'customer', p_tenant_id,
    'customer.login', 'customer_session', v_session_id,
    'Login do cliente pelo portal', jsonb_build_object('ip', p_created_ip)
  );

  -- consumo atômico do entry token (uso único), quando aplicável
  if p_entry_token_id is not null then
    update public.entry_tokens
    set consumed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where id = p_entry_token_id
      and consumed_at is null;
  end if;

  return v_session_id;
end;
$$;


--
-- Name: customer_session_revoke_log(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_session_revoke_log(p_token_hash text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_session public.customer_sessions%rowtype;
begin
  select *
  into v_session
  from public.customer_sessions
  where token_hash = p_token_hash
    and revoked_at is null
  for update;

  if v_session.id is null then
    return;
  end if;

  update public.customer_sessions
  set revoked_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = v_session.id;

  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_session.customer_id, 'customer', v_session.tenant_id,
    'customer.session_revoked', 'customer_session', v_session.id,
    'Logout do cliente pelo portal', '{}'::jsonb
  );
end;
$$;


--
-- Name: customer_session_uid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_session_uid(p_token_hash text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select cs.customer_id
  from public.customer_sessions cs
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now());
$$;


--
-- Name: customer_unlink_vehicle(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_unlink_vehicle(p_token_hash text, p_vehicle_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_customer record;
begin
  select cc.id as customer_id, cc.tenant_id
  into v_customer
  from public.customer_sessions cs
  join public.customers cc on cc.id = cs.customer_id
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now())
    and cc.is_active = true
  limit 1;

  if v_customer.customer_id is null then
    raise exception 'Sessão inválida ou expirada.';
  end if;

  -- Soft delete: nunca apaga ordens, pagamentos ou histórico.
  update public.vehicles
  set is_active = false,
      updated_at = timezone('utc', now())
  where id = p_vehicle_id
    and tenant_id = v_customer.tenant_id
    and customer_id = v_customer.customer_id;

  -- evento auditável atômico (mesma transação do desvínculo)
  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.customer_id, 'customer', v_customer.tenant_id,
    'vehicle.unlinked', 'vehicle', p_vehicle_id,
    'Veículo desvinculado pelo portal', '{}'::jsonb
  );
end;
$$;


--
-- Name: ensure_tenant_settings_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_tenant_settings_defaults() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: inventory_register_movement(uuid, uuid, text, numeric, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_register_movement(p_tenant_id uuid, p_item_id uuid, p_kind text, p_quantity numeric, p_note text DEFAULT NULL::text, p_unit_cost numeric DEFAULT NULL::numeric, p_source text DEFAULT 'manual'::text) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
declare
  v_item public.inventory_items%rowtype;
  v_new_quantity numeric(12, 3);
begin
  if p_kind not in ('initial', 'in', 'out') then
    raise exception 'INVALID_MOVEMENT_KIND';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_MOVEMENT_QUANTITY';
  end if;

  select *
  into v_item
  from public.inventory_items
  where id = p_item_id
    and tenant_id = p_tenant_id
    and is_active = true
  for update;

  if not found then
    raise exception 'INVENTORY_ITEM_NOT_FOUND';
  end if;

  if p_kind = 'out' and coalesce(v_item.quantity, 0) < p_quantity then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  v_new_quantity := case
    when p_kind = 'out' then coalesce(v_item.quantity, 0) - p_quantity
    else coalesce(v_item.quantity, 0) + p_quantity
  end;

  update public.inventory_items
  set quantity = v_new_quantity,
      last_entry_at = case when p_kind in ('initial', 'in') then timezone('utc', now()) else last_entry_at end,
      updated_at = timezone('utc', now())
  where id = v_item.id;

  insert into public.inventory_movements (
    tenant_id,
    item_id,
    shelf_id,
    kind,
    quantity,
    unit_cost,
    note,
    source,
    created_by
  ) values (
    p_tenant_id,
    v_item.id,
    v_item.shelf_id,
    p_kind,
    p_quantity,
    p_unit_cost,
    p_note,
    coalesce(nullif(trim(p_source), ''), 'manual'),
    auth.uid()
  );

  return v_new_quantity;
end;
$$;


--
-- Name: is_tenant_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_member(target_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = target_tenant_id
      and tu.user_id = auth.uid()
      and tu.is_active = true
  );
$$;


--
-- Name: is_tenant_owner_or_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_owner_or_manager(target_tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select coalesce(public.current_tenant_role(target_tenant_id) in ('owner', 'manager'), false);
$$;


--
-- Name: landing_comment_submit(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.landing_comment_submit(p_marketing_asset_id uuid, p_author_name text, p_author_identity_hash text, p_body text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_tenant_id uuid;
  v_name text;
  v_body text;
  v_id uuid;
begin
  if p_marketing_asset_id is null or p_author_identity_hash is null or length(p_author_identity_hash) < 16 then
    raise exception 'Dados inválidos.';
  end if;

  -- sanitização básica server-side (a camada TS remove HTML/controla limites; aqui é a barreira final)
  v_name := btrim(regexp_replace(coalesce(p_author_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));

  if v_name = '' or length(v_name) > 60 then
    raise exception 'Nome inválido.';
  end if;

  if v_body = '' or length(v_body) > 500 then
    raise exception 'Comentário inválido.';
  end if;

  select tenant_id into v_tenant_id
  from public.marketing_assets
  where id = p_marketing_asset_id
    and status = 'approved';

  if v_tenant_id is null then
    raise exception 'Publicação inválida.';
  end if;

  insert into public.landing_comments (tenant_id, marketing_asset_id, author_name, author_identity_hash, body, status)
  values (v_tenant_id, p_marketing_asset_id, v_name, p_author_identity_hash, v_body, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;


--
-- Name: landing_comments_approved(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.landing_comments_approved(p_marketing_asset_id uuid) RETURNS TABLE(id uuid, author_name text, body text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select c.id, c.author_name, c.body, c.created_at
  from public.landing_comments c
  where c.marketing_asset_id = p_marketing_asset_id
    and c.status = 'approved'
  order by c.created_at asc;
$$;


--
-- Name: landing_like_post(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.landing_like_post(p_marketing_asset_id uuid, p_identity_hash text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_tenant_id uuid;
  v_count bigint;
begin
  if p_marketing_asset_id is null or p_identity_hash is null or length(p_identity_hash) < 16 then
    raise exception 'Dados inválidos.';
  end if;

  select tenant_id into v_tenant_id
  from public.marketing_assets
  where id = p_marketing_asset_id
    and status = 'approved';

  if v_tenant_id is null then
    raise exception 'Publicação inválida.';
  end if;

  insert into public.landing_likes (tenant_id, marketing_asset_id, identity_hash)
  values (v_tenant_id, p_marketing_asset_id, p_identity_hash)
  on conflict (tenant_id, marketing_asset_id, identity_hash) do nothing;

  select count(*) into v_count
  from public.landing_likes
  where marketing_asset_id = p_marketing_asset_id;

  return v_count;
end;
$$;


--
-- Name: landing_post_like_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.landing_post_like_count(p_marketing_asset_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select count(*) from public.landing_likes where marketing_asset_id = p_marketing_asset_id;
$$;


--
-- Name: list_due_return_reminders(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_due_return_reminders(p_now timestamp with time zone) RETURNS TABLE(tenant_id uuid, tenant_name text, customer_id uuid, customer_name text, whatsapp text, vehicle_model text, vehicle_plate text, service_name text, last_attendance_at timestamp with time zone, return_reminder_message text, return_reminder_days integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: mark_daily_payout_paid_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_daily_payout_paid_atomic(p_employee_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: move_attendance_to_box_atomic(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_attendance_to_box_atomic(p_attendance_id uuid, p_box_id uuid, p_queue_position integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_attendance public.attendances%rowtype;
  v_box public.operation_boxes%rowtype;
  v_actor_employee_id uuid;
  v_new_status public.attendance_status;
begin
  select *
  into v_attendance
  from public.attendances
  where id = p_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento nao encontrado.';
  end if;

  select *
  into v_box
  from public.operation_boxes
  where id = p_box_id
    and is_active = true;

  if v_box.id is null then
    raise exception 'Box operacional nao encontrado.';
  end if;

  if v_box.tenant_id <> v_attendance.tenant_id then
    raise exception 'Box invalido para este tenant.';
  end if;

  v_actor_employee_id := public.current_employee_id(v_attendance.tenant_id);

  if not public.is_tenant_owner_or_manager(v_attendance.tenant_id) then
    if public.current_tenant_role(v_attendance.tenant_id) <> 'operator'
      or v_actor_employee_id is null
      or v_attendance.employee_id <> v_actor_employee_id then
      raise exception 'Acesso negado.';
    end if;
  end if;

  v_new_status := case
    when v_box.kind = 'entry' then 'waiting'::public.attendance_status
    when v_box.kind = 'wash' then 'washing'::public.attendance_status
    when v_box.kind in ('dry', 'finish') then 'finishing'::public.attendance_status
    when v_box.kind = 'ready' then 'ready'::public.attendance_status
    else v_attendance.status
  end;

  update public.attendances
  set current_box_id = v_box.id,
      queue_position = p_queue_position,
      operational_stage = v_box.kind::text,
      status = v_new_status,
      started_at = case
        when v_new_status = 'washing' then coalesce(started_at, timezone('utc', now()))
        else started_at
      end,
      ready_at = case
        when v_new_status = 'ready' then coalesce(ready_at, timezone('utc', now()))
        else ready_at
      end
  where id = v_attendance.id;

  insert into public.attendance_box_events (
    tenant_id,
    attendance_id,
    from_box_id,
    to_box_id,
    moved_by,
    note
  ) values (
    v_attendance.tenant_id,
    v_attendance.id,
    v_attendance.current_box_id,
    v_box.id,
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  );

  update public.attendance_public_status
  set status = v_new_status,
      eta_minutes = case
        when v_new_status = 'ready' then 0
        else greatest(coalesce(v_attendance.estimated_minutes, 0) + coalesce(v_attendance.extra_minutes, 0), 0)
      end
  where attendance_id = v_attendance.id;
end;
$$;


--
-- Name: rate_limit_increment(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rate_limit_increment(p_tenant_id uuid, p_key text, p_window_seconds integer) RETURNS TABLE(current_count integer, reset_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_row public.rate_limits%rowtype;
begin
  if p_tenant_id is null or p_key is null or p_key = '' then
    raise exception 'Parâmetros de rate limit inválidos.';
  end if;

  select *
  into v_row
  from public.rate_limits
  where tenant_id = p_tenant_id
    and key = p_key
  for update;

  if v_row.key is null or v_row.reset_at <= timezone('utc', now()) then
    insert into public.rate_limits (tenant_id, key, count, reset_at)
    values (p_tenant_id, p_key, 1, timezone('utc', now()) + make_interval(secs => p_window_seconds))
    on conflict (tenant_id, key) do update
      set count = 1,
          reset_at = timezone('utc', now()) + make_interval(secs => p_window_seconds)
    returning count, rate_limits.reset_at into v_row.count, v_row.reset_at;
  else
    update public.rate_limits
    set count = v_row.count + 1
    where tenant_id = p_tenant_id
      and key = p_key
    returning count, rate_limits.reset_at into v_row.count, v_row.reset_at;
  end if;

  delete from public.rate_limits
  where rate_limits.reset_at < timezone('utc', now()) - interval '1 day';

  return query select v_row.count, v_row.reset_at;
end;
$$;


--
-- Name: resolve_vehicle_size_tier(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_vehicle_size_tier(p_vehicle_type text, p_overrides jsonb) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select coalesce(
    nullif(p_overrides ->> p_vehicle_type, ''),
    case lower(trim(p_vehicle_type))
      when 'hatch' then 'passeio'
      when 'sedan' then 'medio'
      when 'wagon' then 'medio'
      when 'pickup_small' then 'grande'
      when 'suv' then 'grande'
      when 'pickup_large' then 'grande'
      when 'van' then 'bem_grande'
      when 'micro_bus' then 'bem_grande'
      when 'truck' then 'bem_grande'
      when 'bus' then 'bem_grande'
      else 'passeio'
    end
  );
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: toggle_employee_presence_atomic(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_employee_presence_atomic(p_employee_id uuid, p_is_present boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: appointment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    service_id uuid,
    name text NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    estimated_minutes integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid,
    vehicle_id uuid,
    service_id uuid,
    scheduled_for timestamp with time zone NOT NULL,
    notes text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_price numeric(10,2) DEFAULT 0 NOT NULL,
    idempotency_key text,
    payment_intent_id uuid
);


--
-- Name: attendance_box_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_box_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    from_box_id uuid,
    to_box_id uuid,
    moved_by uuid,
    moved_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    note text
);


--
-- Name: attendance_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    box_id uuid,
    uploaded_by uuid,
    kind public.attendance_media_kind NOT NULL,
    file_path text NOT NULL,
    mime_type text NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: attendance_public_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_public_status (
    attendance_id uuid NOT NULL,
    public_code text NOT NULL,
    vehicle_label text NOT NULL,
    status public.attendance_status NOT NULL,
    eta_minutes integer,
    step_index integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: attendance_service_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    service_id uuid,
    name text NOT NULL,
    estimated_minutes integer,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT attendance_service_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'canceled'::text])))
);


--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    service_id uuid,
    employee_id uuid,
    status public.attendance_status DEFAULT 'waiting'::public.attendance_status NOT NULL,
    estimated_minutes integer,
    base_price numeric(10,2) DEFAULT 0 NOT NULL,
    final_price numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method public.payment_method DEFAULT 'pending'::public.payment_method NOT NULL,
    public_code text DEFAULT upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)) NOT NULL,
    public_tracking_enabled boolean DEFAULT true NOT NULL,
    notify_customer boolean DEFAULT false NOT NULL,
    notes text,
    started_at timestamp with time zone,
    ready_at timestamp with time zone,
    delivered_at timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    extra_minutes integer DEFAULT 0 NOT NULL,
    current_box_id uuid,
    queue_position integer,
    operational_stage text DEFAULT 'queue'::text NOT NULL,
    billing_mode text DEFAULT 'standard'::text NOT NULL,
    billing_due_date date,
    service_label text,
    idempotency_key text,
    source text DEFAULT 'operator'::text NOT NULL,
    payment_intent_id uuid,
    CONSTRAINT attendances_source_check CHECK ((source = ANY (ARRAY['operator'::text, 'portal'::text, 'appointment'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    actor_email text,
    actor_role text NOT NULL,
    tenant_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    actor_customer_id uuid
);


--
-- Name: cash_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    cash_session_id uuid,
    attendance_id uuid,
    kind public.cash_entry_kind NOT NULL,
    payment_method public.payment_method,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    effective_date date DEFAULT (timezone('America/Sao_Paulo'::text, now()))::date NOT NULL,
    settlement_status text DEFAULT 'settled'::text NOT NULL,
    card_kind text
);


--
-- Name: cash_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    opened_by uuid,
    closed_by uuid,
    opened_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at timestamp with time zone,
    opening_balance numeric(10,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(10,2),
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: customer_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_credentials (
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    password_hash text NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_changed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: customer_order_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_order_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    kind text DEFAULT 'order'::text NOT NULL,
    service_ids uuid[] NOT NULL,
    reward_id uuid,
    idempotency_key uuid NOT NULL,
    session_token_hash text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT customer_order_drafts_kind_check CHECK ((kind = ANY (ARRAY['order'::text, 'appointment'::text]))),
    CONSTRAINT customer_order_drafts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'used'::text, 'expired'::text])))
);


--
-- Name: customer_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_ip inet,
    user_agent text
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    whatsapp text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_return_reminder_sent_at timestamp with time zone,
    legal_name text,
    trade_name text,
    email text,
    document text,
    document_type text,
    state_registration text,
    municipal_registration text,
    postal_code text,
    street text,
    street_number text,
    complement text,
    neighborhood text,
    city text,
    state text,
    contact_phone_1 text,
    contact_phone_2 text,
    is_fleet boolean DEFAULT false NOT NULL,
    phone_normalized text,
    gender text,
    birth_date date,
    CONSTRAINT customers_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['female'::text, 'male'::text, 'non_binary'::text, 'other'::text]))))
);


--
-- Name: employee_work_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_work_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    logged_in_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    logged_out_at timestamp with time zone,
    ended_by_shift boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    role_label text NOT NULL,
    can_access_system boolean DEFAULT false NOT NULL,
    payment_type public.employee_payment_type DEFAULT 'daily'::public.employee_payment_type NOT NULL,
    payment_value numeric(10,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    auth_user_id uuid,
    is_present boolean DEFAULT false NOT NULL,
    email text,
    contact_phone text,
    cpf text,
    birth_date date,
    postal_code text,
    street text,
    street_number text,
    complement text,
    neighborhood text,
    city text,
    state text,
    internal_code text
);


--
-- Name: entry_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phone_normalized text NOT NULL,
    plate_normalized text NOT NULL,
    purpose text DEFAULT 'entry'::text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT entry_tokens_purpose_check CHECK ((purpose = 'entry'::text))
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    shelf_id uuid NOT NULL,
    name text NOT NULL,
    brand text,
    barcode text,
    sku text,
    category text,
    supplier text,
    unit text DEFAULT 'un'::text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    min_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    cost_price numeric(12,2) DEFAULT 0 NOT NULL,
    sale_price numeric(12,2) DEFAULT 0 NOT NULL,
    package_size text,
    location_label text,
    batch_code text,
    expiration_date date,
    notes text,
    last_entry_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    item_id uuid NOT NULL,
    shelf_id uuid NOT NULL,
    kind text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(12,2),
    note text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT inventory_movements_kind_check CHECK ((kind = ANY (ARRAY['initial'::text, 'in'::text, 'out'::text]))),
    CONSTRAINT inventory_movements_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: inventory_shelves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_shelves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    note text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: landing_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    marketing_asset_id uuid NOT NULL,
    author_name text NOT NULL,
    author_identity_hash text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    moderation_suggestion text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT landing_comments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: landing_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    marketing_asset_id uuid NOT NULL,
    identity_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: lead_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_company_id uuid NOT NULL,
    has_website boolean DEFAULT false NOT NULL,
    has_phone boolean DEFAULT false NOT NULL,
    has_google_maps boolean DEFAULT false NOT NULL,
    has_instagram boolean DEFAULT false NOT NULL,
    instagram_url text,
    has_low_reviews boolean DEFAULT false NOT NULL,
    has_poor_presence boolean DEFAULT false NOT NULL,
    problems_found text[] DEFAULT '{}'::text[] NOT NULL,
    opportunity_reason text,
    ai_summary text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: lead_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name text NOT NULL,
    business_type text NOT NULL,
    phone text,
    address text,
    city text,
    state text,
    latitude double precision,
    longitude double precision,
    website text,
    google_maps_url text,
    rating numeric(3,2),
    review_count integer DEFAULT 0 NOT NULL,
    source text NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    opportunity_score integer DEFAULT 0 NOT NULL,
    opportunity_level text DEFAULT 'baixa'::text NOT NULL,
    status text DEFAULT 'found'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    cnpj text,
    email text,
    cnae_principal text,
    cnae_secundaria text,
    abertura_date date,
    contato_quality text,
    contact_risk_level text,
    contact_role_hint text,
    contact_evidence text,
    recommended_channel text,
    import_batch_label text,
    CONSTRAINT lead_companies_opportunity_level_check CHECK ((opportunity_level = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text]))),
    CONSTRAINT lead_companies_status_check CHECK ((status = ANY (ARRAY['found'::text, 'analyzed'::text, 'message_generated'::text, 'contacted'::text, 'responded'::text, 'demo_scheduled'::text, 'closed_won'::text, 'lost'::text, 'kept'::text, 'archived'::text])))
);


--
-- Name: lead_company_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_company_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_company_id uuid NOT NULL,
    activity_type text NOT NULL,
    channel text,
    note text,
    created_by_email text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: lead_email_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_email_dispatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_company_id uuid NOT NULL,
    lead_message_id uuid,
    provider text DEFAULT 'resend'::text NOT NULL,
    provider_email_id text NOT NULL,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    last_event text DEFAULT 'api_accepted'::text NOT NULL,
    last_error text,
    raw_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT lead_email_dispatches_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'delivery_delayed'::text, 'bounced'::text, 'complained'::text, 'opened'::text, 'clicked'::text, 'failed'::text, 'suppressed'::text, 'received'::text])))
);


--
-- Name: lead_email_sequence_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_email_sequence_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_company_id uuid NOT NULL,
    sequence_id uuid NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    next_send_at timestamp with time zone,
    last_sent_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT lead_email_sequence_enrollments_current_step_check CHECK (((current_step >= 0) AND (current_step <= 6))),
    CONSTRAINT lead_email_sequence_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'unsubscribed'::text])))
);


--
-- Name: lead_email_sequence_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_email_sequence_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_id uuid NOT NULL,
    step_number integer NOT NULL,
    subject text,
    body_text text,
    image_url text,
    delay_days integer DEFAULT 7 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT lead_email_sequence_steps_delay_days_check CHECK (((delay_days >= 0) AND (delay_days <= 365))),
    CONSTRAINT lead_email_sequence_steps_step_number_check CHECK (((step_number >= 1) AND (step_number <= 6)))
);


--
-- Name: lead_email_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_email_sequences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_key text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: lead_hunter_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_hunter_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    niche text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    radius_km integer NOT NULL,
    max_results integer NOT NULL,
    total_found integer DEFAULT 0 NOT NULL,
    total_saved integer DEFAULT 0 NOT NULL,
    total_duplicates integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT lead_hunter_jobs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'finished'::text, 'failed'::text])))
);


--
-- Name: lead_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_company_id uuid NOT NULL,
    message_text text NOT NULL,
    message_type text DEFAULT 'whatsapp'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    subject text
);


--
-- Name: loyalty_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    attendance_id uuid,
    kind text DEFAULT 'wash'::text NOT NULL,
    wash_number integer NOT NULL,
    cycle_started_at date NOT NULL,
    event_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    source text NOT NULL,
    actor_customer_id uuid,
    actor_user_id uuid,
    reversal_reason text,
    idempotency_key text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT loyalty_entries_kind_check CHECK ((kind = ANY (ARRAY['wash'::text, 'adjustment'::text, 'reversal'::text]))),
    CONSTRAINT loyalty_entries_source_check CHECK ((source = ANY (ARRAY['attendance_delivered'::text, 'portal'::text, 'operator'::text, 'system'::text]))),
    CONSTRAINT loyalty_entries_wash_number_check CHECK ((wash_number >= 1))
);


--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text DEFAULT 'Fidelidade'::text NOT NULL,
    washes_required integer DEFAULT 10 NOT NULL,
    reward_type text DEFAULT 'free_wash'::text NOT NULL,
    eligibility_rule text DEFAULT 'concluded'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT loyalty_programs_eligibility_rule_check CHECK ((eligibility_rule = ANY (ARRAY['concluded'::text, 'concluded_and_paid'::text]))),
    CONSTRAINT loyalty_programs_washes_required_check CHECK ((washes_required >= 1))
);


--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    entry_id uuid NOT NULL,
    status text DEFAULT 'generated'::text NOT NULL,
    used_attendance_id uuid,
    used_at timestamp with time zone,
    reverted_at timestamp with time zone,
    canceled_at timestamp with time zone,
    cancel_reason text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT loyalty_rewards_status_check CHECK ((status = ANY (ARRAY['generated'::text, 'available'::text, 'used'::text, 'reverted'::text, 'canceled'::text])))
);


--
-- Name: marketing_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attendance_id uuid,
    media_id uuid,
    kind text NOT NULL,
    title text,
    generated_text text NOT NULL,
    cta text,
    hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    prompt_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: operation_boxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_boxes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    kind public.operation_box_kind NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    sla_minutes integer,
    color_token text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    sla_unit text DEFAULT 'minutes'::text NOT NULL,
    CONSTRAINT operation_boxes_sla_unit_check CHECK ((sla_unit = ANY (ARRAY['minutes'::text, 'hours_minutes'::text, 'days'::text, 'weeks'::text, 'months'::text])))
);


--
-- Name: payment_intents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    attendance_id uuid,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    provider text,
    provider_reference text,
    idempotency_key text NOT NULL,
    succeeded_at timestamp with time zone,
    failed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    canceled_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_ip inet,
    appointment_id uuid,
    CONSTRAINT payment_intents_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payment_intents_payment_method_check CHECK ((payment_method = ANY (ARRAY['pix'::text, 'card'::text, 'cash'::text, 'other'::text]))),
    CONSTRAINT payment_intents_status_check CHECK ((status = ANY (ARRAY['not_required'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text, 'canceled'::text])))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    price_monthly numeric(10,2) DEFAULT 0 NOT NULL,
    operator_limit integer,
    appointment_limit integer,
    whatsapp_limit integer,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'admin_master'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    key text DEFAULT 'default'::text NOT NULL,
    platform_name text DEFAULT 'VerificWash'::text NOT NULL,
    logo_url text,
    primary_domain text,
    smtp_host text,
    smtp_port integer,
    smtp_username text,
    smtp_password text,
    smtp_from_email text,
    whatsapp_provider text,
    whatsapp_base_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    evolution_instance text,
    evolution_api_key text,
    evolution_enabled boolean DEFAULT false NOT NULL,
    default_return_reminder_enabled boolean DEFAULT true NOT NULL,
    default_return_reminder_days integer DEFAULT 30 NOT NULL,
    default_return_reminder_time text DEFAULT '09:00'::text,
    default_queue_entry_message text,
    default_wash_start_message text,
    default_ready_message text,
    default_return_reminder_message text,
    resend_from_email text,
    resend_reply_to_email text,
    resend_webhook_id text,
    resend_webhook_secret text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    key text NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: service_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid,
    service_id uuid NOT NULL,
    request_description text NOT NULL,
    labor_description text,
    labor_amount numeric(12,2) DEFAULT 0 NOT NULL,
    parts_description text,
    parts_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    approved_attendance_id uuid,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT service_quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    average_minutes integer DEFAULT 30 NOT NULL,
    short_description text,
    kind public.service_kind DEFAULT 'main'::public.service_kind NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    price_passeio numeric(10,2) DEFAULT 0 NOT NULL,
    price_medio numeric(10,2) DEFAULT 0 NOT NULL,
    price_grande numeric(10,2) DEFAULT 0 NOT NULL,
    price_bem_grande numeric(10,2) DEFAULT 0 NOT NULL,
    base_service_id uuid,
    addon_minutes integer DEFAULT 0 NOT NULL,
    addon_price_passeio numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_medio numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_grande numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_bem_grande numeric(10,2) DEFAULT 0 NOT NULL,
    minutes_passeio integer DEFAULT 0 NOT NULL,
    minutes_medio integer DEFAULT 0 NOT NULL,
    minutes_grande integer DEFAULT 0 NOT NULL,
    minutes_bem_grande integer DEFAULT 0 NOT NULL,
    addon_minutes_passeio integer DEFAULT 0 NOT NULL,
    addon_minutes_medio integer DEFAULT 0 NOT NULL,
    addon_minutes_grande integer DEFAULT 0 NOT NULL,
    addon_minutes_bem_grande integer DEFAULT 0 NOT NULL,
    time_unit text DEFAULT 'minutes'::text NOT NULL,
    price_app_passeio numeric(10,2) DEFAULT 0 NOT NULL,
    price_app_medio numeric(10,2) DEFAULT 0 NOT NULL,
    price_app_grande numeric(10,2) DEFAULT 0 NOT NULL,
    price_app_bem_grande numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_app_passeio numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_app_medio numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_app_grande numeric(10,2) DEFAULT 0 NOT NULL,
    addon_price_app_bem_grande numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: social_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_publications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    marketing_asset_id uuid NOT NULL,
    platform text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    instagram_media_id text,
    instagram_publish_id text,
    published_at timestamp with time zone,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    subject text NOT NULL,
    description text,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    admin_reply text,
    admin_reply_at timestamp with time zone,
    admin_reply_by uuid
);


--
-- Name: tenant_company_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_company_profiles (
    tenant_id uuid NOT NULL,
    legal_name text NOT NULL,
    trade_name text NOT NULL,
    cnpj text,
    state_registration text,
    municipal_registration text,
    email text,
    phone text,
    phone_secondary text,
    postal_code text,
    street text,
    street_number text,
    complement text,
    neighborhood text,
    city text,
    state text,
    country text DEFAULT 'Brasil'::text NOT NULL,
    representative_name text NOT NULL,
    representative_role text,
    representative_email text NOT NULL,
    representative_phone text,
    representative_phone_secondary text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    website text
);


--
-- Name: tenant_growth_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_growth_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    step_key text NOT NULL,
    notes text,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: tenant_instagram_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_instagram_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    instagram_account_id text NOT NULL,
    facebook_page_id text,
    account_name text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp with time zone,
    connected_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: tenant_landing_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_landing_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    marketing_asset_id uuid,
    attendance_media_id uuid,
    file_path text NOT NULL,
    mime_type text DEFAULT 'image/jpeg'::text NOT NULL,
    kind text DEFAULT 'post'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tenant_landing_media_kind_check CHECK ((kind = ANY (ARRAY['post'::text, 'gallery'::text])))
);


--
-- Name: tenant_landing_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_landing_pages (
    tenant_id uuid NOT NULL,
    category text,
    city_label text,
    bio text,
    cover_image_url text,
    profile_image_url text,
    instagram_url text,
    facebook_url text,
    website_url text,
    address_label text,
    map_embed_url text,
    opening_hours text,
    cta_whatsapp_message text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    contact_email text,
    background_style text DEFAULT 'dark'::text NOT NULL
);


--
-- Name: tenant_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_name text NOT NULL,
    rating smallint DEFAULT 5 NOT NULL,
    quote text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tenant_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    tenant_id uuid NOT NULL,
    default_service_minutes integer DEFAULT 30,
    queue_entry_message text,
    wash_start_message text,
    ready_message text,
    return_reminder_message text,
    evolution_base_url text,
    evolution_instance text,
    evolution_api_key text,
    evolution_enabled boolean DEFAULT false NOT NULL,
    operator_can_edit_status boolean DEFAULT true NOT NULL,
    operator_can_view_all_cars boolean DEFAULT true NOT NULL,
    operator_can_view_customer_phone boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    logout_before timestamp with time zone,
    return_reminder_enabled boolean DEFAULT false NOT NULL,
    return_reminder_days integer DEFAULT 30 NOT NULL,
    return_reminder_time text DEFAULT '09:00'::text,
    operations_mode text DEFAULT 'boxes'::text NOT NULL,
    tv_mode_enabled boolean DEFAULT false NOT NULL,
    require_ready_photo boolean DEFAULT false NOT NULL,
    allow_step_photos boolean DEFAULT true NOT NULL,
    customer_messages_enabled boolean DEFAULT false NOT NULL,
    queue_entry_message_enabled boolean DEFAULT true NOT NULL,
    wash_start_message_enabled boolean DEFAULT false NOT NULL,
    finishing_message text,
    finishing_message_enabled boolean DEFAULT false NOT NULL,
    ready_message_enabled boolean DEFAULT true NOT NULL,
    whatsapp_pairing_token text DEFAULT (gen_random_uuid())::text NOT NULL,
    instagram_enabled boolean DEFAULT false NOT NULL,
    instagram_auto_publish_enabled boolean DEFAULT false NOT NULL,
    instagram_default_publish_mode text DEFAULT 'manual'::text NOT NULL,
    landing_enabled boolean DEFAULT false NOT NULL,
    operator_inventory_enabled boolean DEFAULT false NOT NULL,
    operation_flow_locked boolean DEFAULT true NOT NULL,
    vehicle_type_tier_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_mode text DEFAULT 'order_without_online_payment'::text NOT NULL,
    portal_payment_methods jsonb DEFAULT '["cash", "pix", "card"]'::jsonb NOT NULL,
    CONSTRAINT tenant_settings_instagram_default_publish_mode_check CHECK ((instagram_default_publish_mode = 'manual'::text)),
    CONSTRAINT tenant_settings_operations_mode_check CHECK ((operations_mode = ANY (ARRAY['classic'::text, 'boxes'::text]))),
    CONSTRAINT tenant_settings_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['order_without_online_payment'::text, 'online_required'::text])))
);


--
-- Name: tenant_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'trialing'::text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: tenant_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'operator'::public.app_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    whatsapp text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    operational_profile text DEFAULT 'automotive'::text NOT NULL,
    CONSTRAINT tenants_operational_profile_check CHECK ((operational_profile = ANY (ARRAY['automotive'::text, 'generic'::text])))
);


--
-- Name: vehicle_catalog_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_catalog_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: vehicle_catalog_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_catalog_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: vehicle_catalog_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_catalog_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    plate text NOT NULL,
    model text NOT NULL,
    color text,
    vehicle_type text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    brand text,
    usage_type text DEFAULT 'particular'::text NOT NULL,
    size_tier text,
    tier_source text,
    vehicle_source text DEFAULT 'operator'::text NOT NULL,
    confirmed_at timestamp with time zone,
    last_vehicle_data_at timestamp with time zone,
    CONSTRAINT vehicles_size_tier_check CHECK (((size_tier IS NULL) OR (size_tier = ANY (ARRAY['passeio'::text, 'medio'::text, 'grande'::text, 'bem_grande'::text])))),
    CONSTRAINT vehicles_tier_source_check CHECK (((tier_source IS NULL) OR (tier_source = ANY (ARRAY['engine'::text, 'lookup'::text, 'manual'::text])))),
    CONSTRAINT vehicles_usage_type_check CHECK ((usage_type = ANY (ARRAY['particular'::text, 'app_driver'::text, 'taxi'::text, 'company'::text, 'other_professional'::text]))),
    CONSTRAINT vehicles_vehicle_source_check CHECK ((vehicle_source = ANY (ARRAY['operator'::text, 'portal'::text, 'lookup'::text])))
);


--
-- Name: appointment_items appointment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_items
    ADD CONSTRAINT appointment_items_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: attendance_box_events attendance_box_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_pkey PRIMARY KEY (id);


--
-- Name: attendance_media attendance_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_media
    ADD CONSTRAINT attendance_media_pkey PRIMARY KEY (id);


--
-- Name: attendance_public_status attendance_public_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_public_status
    ADD CONSTRAINT attendance_public_status_pkey PRIMARY KEY (attendance_id);


--
-- Name: attendance_public_status attendance_public_status_public_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_public_status
    ADD CONSTRAINT attendance_public_status_public_code_key UNIQUE (public_code);


--
-- Name: attendance_service_items attendance_service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_service_items
    ADD CONSTRAINT attendance_service_items_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_public_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_public_code_key UNIQUE (public_code);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cash_entries cash_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_pkey PRIMARY KEY (id);


--
-- Name: cash_sessions cash_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_credentials customer_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_pkey PRIMARY KEY (customer_id);


--
-- Name: customer_order_drafts customer_order_drafts_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: customer_order_drafts customer_order_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_pkey PRIMARY KEY (id);


--
-- Name: customer_sessions customer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_sessions customer_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employee_work_sessions employee_work_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_work_sessions
    ADD CONSTRAINT employee_work_sessions_pkey PRIMARY KEY (id);


--
-- Name: employees employees_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: entry_tokens entry_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_tokens
    ADD CONSTRAINT entry_tokens_pkey PRIMARY KEY (id);


--
-- Name: entry_tokens entry_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_tokens
    ADD CONSTRAINT entry_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_shelves inventory_shelves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_shelves
    ADD CONSTRAINT inventory_shelves_pkey PRIMARY KEY (id);


--
-- Name: landing_comments landing_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_comments
    ADD CONSTRAINT landing_comments_pkey PRIMARY KEY (id);


--
-- Name: landing_likes landing_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_likes
    ADD CONSTRAINT landing_likes_pkey PRIMARY KEY (id);


--
-- Name: landing_likes landing_likes_tenant_id_marketing_asset_id_identity_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_likes
    ADD CONSTRAINT landing_likes_tenant_id_marketing_asset_id_identity_hash_key UNIQUE (tenant_id, marketing_asset_id, identity_hash);


--
-- Name: lead_analysis lead_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_analysis
    ADD CONSTRAINT lead_analysis_pkey PRIMARY KEY (id);


--
-- Name: lead_companies lead_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_companies
    ADD CONSTRAINT lead_companies_pkey PRIMARY KEY (id);


--
-- Name: lead_company_activities lead_company_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_company_activities
    ADD CONSTRAINT lead_company_activities_pkey PRIMARY KEY (id);


--
-- Name: lead_email_dispatches lead_email_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_dispatches
    ADD CONSTRAINT lead_email_dispatches_pkey PRIMARY KEY (id);


--
-- Name: lead_email_dispatches lead_email_dispatches_provider_email_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_dispatches
    ADD CONSTRAINT lead_email_dispatches_provider_email_id_key UNIQUE (provider_email_id);


--
-- Name: lead_email_sequence_enrollments lead_email_sequence_enrollments_lead_company_id_sequence_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_enrollments
    ADD CONSTRAINT lead_email_sequence_enrollments_lead_company_id_sequence_id_key UNIQUE (lead_company_id, sequence_id);


--
-- Name: lead_email_sequence_enrollments lead_email_sequence_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_enrollments
    ADD CONSTRAINT lead_email_sequence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: lead_email_sequence_steps lead_email_sequence_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_steps
    ADD CONSTRAINT lead_email_sequence_steps_pkey PRIMARY KEY (id);


--
-- Name: lead_email_sequence_steps lead_email_sequence_steps_sequence_id_step_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_steps
    ADD CONSTRAINT lead_email_sequence_steps_sequence_id_step_number_key UNIQUE (sequence_id, step_number);


--
-- Name: lead_email_sequences lead_email_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequences
    ADD CONSTRAINT lead_email_sequences_pkey PRIMARY KEY (id);


--
-- Name: lead_email_sequences lead_email_sequences_sequence_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequences
    ADD CONSTRAINT lead_email_sequences_sequence_key_key UNIQUE (sequence_key);


--
-- Name: lead_hunter_jobs lead_hunter_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_hunter_jobs
    ADD CONSTRAINT lead_hunter_jobs_pkey PRIMARY KEY (id);


--
-- Name: lead_messages lead_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_messages
    ADD CONSTRAINT lead_messages_pkey PRIMARY KEY (id);


--
-- Name: loyalty_entries loyalty_entries_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: loyalty_entries loyalty_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_pkey PRIMARY KEY (id);


--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);


--
-- Name: marketing_assets marketing_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_pkey PRIMARY KEY (id);


--
-- Name: message_dispatch_queue message_dispatch_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_dispatch_queue
    ADD CONSTRAINT message_dispatch_queue_pkey PRIMARY KEY (id);


--
-- Name: operation_boxes operation_boxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_boxes
    ADD CONSTRAINT operation_boxes_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);


--
-- Name: platform_admins platform_admins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_user_id_key UNIQUE (user_id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_tenant_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_tenant_id_key_key UNIQUE (tenant_id, key);


--
-- Name: service_quotes service_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: social_publications social_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publications
    ADD CONSTRAINT social_publications_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: tenant_company_profiles tenant_company_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_company_profiles
    ADD CONSTRAINT tenant_company_profiles_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_growth_progress tenant_growth_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_growth_progress
    ADD CONSTRAINT tenant_growth_progress_pkey PRIMARY KEY (id);


--
-- Name: tenant_instagram_accounts tenant_instagram_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_instagram_accounts
    ADD CONSTRAINT tenant_instagram_accounts_pkey PRIMARY KEY (id);


--
-- Name: tenant_landing_media tenant_landing_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_media
    ADD CONSTRAINT tenant_landing_media_pkey PRIMARY KEY (id);


--
-- Name: tenant_landing_pages tenant_landing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_pages
    ADD CONSTRAINT tenant_landing_pages_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_reviews tenant_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_reviews
    ADD CONSTRAINT tenant_reviews_pkey PRIMARY KEY (id);


--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_subscriptions tenant_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tenant_subscriptions tenant_subscriptions_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenant_users tenant_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (id);


--
-- Name: tenant_users tenant_users_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: vehicle_catalog_brands vehicle_catalog_brands_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_brands
    ADD CONSTRAINT vehicle_catalog_brands_name_key UNIQUE (name);


--
-- Name: vehicle_catalog_brands vehicle_catalog_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_brands
    ADD CONSTRAINT vehicle_catalog_brands_pkey PRIMARY KEY (id);


--
-- Name: vehicle_catalog_colors vehicle_catalog_colors_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_colors
    ADD CONSTRAINT vehicle_catalog_colors_name_key UNIQUE (name);


--
-- Name: vehicle_catalog_colors vehicle_catalog_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_colors
    ADD CONSTRAINT vehicle_catalog_colors_pkey PRIMARY KEY (id);


--
-- Name: vehicle_catalog_models vehicle_catalog_models_brand_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_models
    ADD CONSTRAINT vehicle_catalog_models_brand_id_name_key UNIQUE (brand_id, name);


--
-- Name: vehicle_catalog_models vehicle_catalog_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_models
    ADD CONSTRAINT vehicle_catalog_models_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_tenant_id_plate_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_tenant_id_plate_key UNIQUE (tenant_id, plate);


--
-- Name: appointment_items_appointment_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointment_items_appointment_sort_idx ON public.appointment_items USING btree (appointment_id, sort_order);


--
-- Name: appointment_items_primary_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointment_items_primary_unique ON public.appointment_items USING btree (appointment_id) WHERE (is_primary = true);


--
-- Name: appointments_tenant_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointments_tenant_idempotency_key_idx ON public.appointments USING btree (tenant_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: attendance_box_events_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_box_events_attendance_idx ON public.attendance_box_events USING btree (attendance_id, moved_at DESC);


--
-- Name: attendance_media_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_media_attendance_idx ON public.attendance_media USING btree (attendance_id, created_at DESC);


--
-- Name: attendance_service_items_primary_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_service_items_primary_unique ON public.attendance_service_items USING btree (attendance_id) WHERE (is_primary = true);


--
-- Name: attendance_service_items_tenant_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_service_items_tenant_attendance_idx ON public.attendance_service_items USING btree (tenant_id, attendance_id, sort_order);


--
-- Name: attendances_tenant_billing_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_tenant_billing_due_date_idx ON public.attendances USING btree (tenant_id, billing_due_date);


--
-- Name: attendances_tenant_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendances_tenant_idempotency_key_idx ON public.attendances USING btree (tenant_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: audit_logs_actor_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_customer_idx ON public.audit_logs USING btree (actor_customer_id);


--
-- Name: cash_entries_tenant_effective_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_entries_tenant_effective_date_idx ON public.cash_entries USING btree (tenant_id, effective_date);


--
-- Name: cash_entries_tenant_settlement_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_entries_tenant_settlement_status_idx ON public.cash_entries USING btree (tenant_id, settlement_status);


--
-- Name: cash_sessions_one_open_per_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cash_sessions_one_open_per_tenant_idx ON public.cash_sessions USING btree (tenant_id) WHERE (status = 'open'::text);


--
-- Name: customer_credentials_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_credentials_tenant_idx ON public.customer_credentials USING btree (tenant_id);


--
-- Name: customer_order_drafts_customer_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_drafts_customer_expires_idx ON public.customer_order_drafts USING btree (customer_id, expires_at);


--
-- Name: customer_order_drafts_tenant_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_order_drafts_tenant_idempotency_idx ON public.customer_order_drafts USING btree (tenant_id, idempotency_key);


--
-- Name: customer_sessions_customer_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_sessions_customer_expires_idx ON public.customer_sessions USING btree (customer_id, expires_at);


--
-- Name: customer_sessions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_sessions_tenant_idx ON public.customer_sessions USING btree (tenant_id);


--
-- Name: customers_tenant_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_tenant_document_idx ON public.customers USING btree (tenant_id, document);


--
-- Name: customers_tenant_is_fleet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_tenant_is_fleet_idx ON public.customers USING btree (tenant_id, is_fleet) WHERE (is_active = true);


--
-- Name: customers_tenant_phone_normalized_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_tenant_phone_normalized_key ON public.customers USING btree (tenant_id, phone_normalized) WHERE (phone_normalized IS NOT NULL);


--
-- Name: employee_work_sessions_one_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_work_sessions_one_open_idx ON public.employee_work_sessions USING btree (employee_id) WHERE (logged_out_at IS NULL);


--
-- Name: employee_work_sessions_tenant_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_work_sessions_tenant_employee_idx ON public.employee_work_sessions USING btree (tenant_id, employee_id, logged_in_at DESC);


--
-- Name: employees_tenant_cpf_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employees_tenant_cpf_unique ON public.employees USING btree (tenant_id, cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text));


--
-- Name: employees_tenant_internal_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employees_tenant_internal_code_idx ON public.employees USING btree (tenant_id, internal_code);


--
-- Name: entry_tokens_tenant_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_tokens_tenant_expires_idx ON public.entry_tokens USING btree (tenant_id, expires_at);


--
-- Name: inventory_items_tenant_barcode_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_items_tenant_barcode_uidx ON public.inventory_items USING btree (tenant_id, barcode) WHERE ((barcode IS NOT NULL) AND (length(TRIM(BOTH FROM barcode)) > 0));


--
-- Name: inventory_items_tenant_shelf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_tenant_shelf_idx ON public.inventory_items USING btree (tenant_id, shelf_id, created_at DESC);


--
-- Name: inventory_movements_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_tenant_created_idx ON public.inventory_movements USING btree (tenant_id, created_at DESC);


--
-- Name: inventory_shelves_tenant_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_shelves_tenant_name_uidx ON public.inventory_shelves USING btree (tenant_id, lower(name)) WHERE (is_active = true);


--
-- Name: inventory_shelves_tenant_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_shelves_tenant_sort_idx ON public.inventory_shelves USING btree (tenant_id, sort_order, created_at);


--
-- Name: landing_comments_asset_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX landing_comments_asset_status_idx ON public.landing_comments USING btree (marketing_asset_id, status, created_at DESC);


--
-- Name: landing_likes_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX landing_likes_asset_idx ON public.landing_likes USING btree (marketing_asset_id, created_at DESC);


--
-- Name: lead_analysis_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_analysis_company_idx ON public.lead_analysis USING btree (lead_company_id, created_at DESC);


--
-- Name: lead_companies_business_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_companies_business_name_idx ON public.lead_companies USING btree (business_name);


--
-- Name: lead_companies_city_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_companies_city_state_idx ON public.lead_companies USING btree (city, state);


--
-- Name: lead_companies_cnae_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_companies_cnae_state_idx ON public.lead_companies USING btree (cnae_principal, state, abertura_date DESC);


--
-- Name: lead_companies_cnpj_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_companies_cnpj_idx ON public.lead_companies USING btree (cnpj) WHERE (cnpj IS NOT NULL);


--
-- Name: lead_companies_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_companies_status_idx ON public.lead_companies USING btree (status, opportunity_level, opportunity_score DESC);


--
-- Name: lead_company_activities_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_company_activities_company_idx ON public.lead_company_activities USING btree (lead_company_id, created_at DESC);


--
-- Name: lead_email_dispatches_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_email_dispatches_company_idx ON public.lead_email_dispatches USING btree (lead_company_id, created_at DESC);


--
-- Name: lead_email_dispatches_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_email_dispatches_status_idx ON public.lead_email_dispatches USING btree (status, created_at DESC);


--
-- Name: lead_email_sequence_enrollments_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_email_sequence_enrollments_company_idx ON public.lead_email_sequence_enrollments USING btree (lead_company_id, created_at DESC);


--
-- Name: lead_email_sequence_enrollments_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_email_sequence_enrollments_due_idx ON public.lead_email_sequence_enrollments USING btree (status, next_send_at);


--
-- Name: lead_email_sequence_steps_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_email_sequence_steps_sequence_idx ON public.lead_email_sequence_steps USING btree (sequence_id, step_number);


--
-- Name: lead_hunter_jobs_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_hunter_jobs_created_idx ON public.lead_hunter_jobs USING btree (created_at DESC);


--
-- Name: lead_messages_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_messages_company_idx ON public.lead_messages USING btree (lead_company_id, created_at DESC);


--
-- Name: loyalty_entries_one_per_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_entries_one_per_attendance_idx ON public.loyalty_entries USING btree (tenant_id, vehicle_id, attendance_id) WHERE (attendance_id IS NOT NULL);


--
-- Name: loyalty_entries_vehicle_wash_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_entries_vehicle_wash_number_idx ON public.loyalty_entries USING btree (tenant_id, vehicle_id, wash_number);


--
-- Name: loyalty_programs_one_active_per_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_programs_one_active_per_tenant_idx ON public.loyalty_programs USING btree (tenant_id) WHERE (is_active = true);


--
-- Name: loyalty_rewards_vehicle_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_rewards_vehicle_status_idx ON public.loyalty_rewards USING btree (tenant_id, vehicle_id, status);


--
-- Name: marketing_assets_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_assets_attendance_idx ON public.marketing_assets USING btree (attendance_id, created_at DESC);


--
-- Name: marketing_assets_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marketing_assets_tenant_created_idx ON public.marketing_assets USING btree (tenant_id, created_at DESC);


--
-- Name: message_dispatch_queue_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_dispatch_queue_status_created_idx ON public.message_dispatch_queue USING btree (status, created_at);


--
-- Name: message_dispatch_queue_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_dispatch_queue_tenant_idx ON public.message_dispatch_queue USING btree (tenant_id, created_at DESC);


--
-- Name: operation_boxes_tenant_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX operation_boxes_tenant_code_idx ON public.operation_boxes USING btree (tenant_id, code);


--
-- Name: operation_boxes_tenant_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_boxes_tenant_sort_idx ON public.operation_boxes USING btree (tenant_id, sort_order);


--
-- Name: payment_intents_appointment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_intents_appointment_idx ON public.payment_intents USING btree (appointment_id);


--
-- Name: payment_intents_attendance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_intents_attendance_idx ON public.payment_intents USING btree (attendance_id);


--
-- Name: payment_intents_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_intents_idempotency_key_idx ON public.payment_intents USING btree (idempotency_key);


--
-- Name: payment_intents_tenant_customer_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_intents_tenant_customer_status_idx ON public.payment_intents USING btree (tenant_id, customer_id, status);


--
-- Name: payment_intents_tenant_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_intents_tenant_idempotency_idx ON public.payment_intents USING btree (tenant_id, idempotency_key);


--
-- Name: rate_limits_reset_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limits_reset_at_idx ON public.rate_limits USING btree (reset_at);


--
-- Name: service_quotes_tenant_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_quotes_tenant_customer_idx ON public.service_quotes USING btree (tenant_id, customer_id, created_at DESC);


--
-- Name: service_quotes_tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_quotes_tenant_status_idx ON public.service_quotes USING btree (tenant_id, status, created_at DESC);


--
-- Name: social_publications_asset_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_publications_asset_created_idx ON public.social_publications USING btree (marketing_asset_id, created_at DESC);


--
-- Name: social_publications_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_publications_tenant_created_idx ON public.social_publications USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_growth_progress_tenant_completed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_growth_progress_tenant_completed_idx ON public.tenant_growth_progress USING btree (tenant_id, completed, updated_at DESC);


--
-- Name: tenant_growth_progress_tenant_step_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_growth_progress_tenant_step_uidx ON public.tenant_growth_progress USING btree (tenant_id, step_key);


--
-- Name: tenant_instagram_accounts_active_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_instagram_accounts_active_tenant_idx ON public.tenant_instagram_accounts USING btree (tenant_id) WHERE (is_active = true);


--
-- Name: tenant_instagram_accounts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_instagram_accounts_tenant_idx ON public.tenant_instagram_accounts USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_landing_media_asset_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_landing_media_asset_sort_idx ON public.tenant_landing_media USING btree (tenant_id, marketing_asset_id, sort_order);


--
-- Name: tenant_landing_media_gallery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_landing_media_gallery_idx ON public.tenant_landing_media USING btree (tenant_id, kind, created_at DESC);


--
-- Name: tenant_reviews_tenant_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_reviews_tenant_sort_idx ON public.tenant_reviews USING btree (tenant_id, sort_order, created_at DESC);


--
-- Name: tenant_settings_whatsapp_pairing_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_settings_whatsapp_pairing_token_key ON public.tenant_settings USING btree (whatsapp_pairing_token);


--
-- Name: vehicle_catalog_brands_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_catalog_brands_name_idx ON public.vehicle_catalog_brands USING btree (name);


--
-- Name: vehicle_catalog_colors_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_catalog_colors_name_idx ON public.vehicle_catalog_colors USING btree (name);


--
-- Name: vehicle_catalog_models_brand_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_catalog_models_brand_name_idx ON public.vehicle_catalog_models USING btree (brand_id, name);


--
-- Name: vehicles_tenant_customer_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicles_tenant_customer_active_idx ON public.vehicles USING btree (tenant_id, customer_id, is_active);


--
-- Name: appointments set_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendance_public_status set_attendance_public_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_attendance_public_status_updated_at BEFORE UPDATE ON public.attendance_public_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendance_service_items set_attendance_service_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_attendance_service_items_updated_at BEFORE UPDATE ON public.attendance_service_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendances set_attendances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_attendances_updated_at BEFORE UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cash_entries set_cash_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cash_entries_updated_at BEFORE UPDATE ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cash_sessions set_cash_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customer_credentials set_customer_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_customer_credentials_updated_at BEFORE UPDATE ON public.customer_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customer_order_drafts set_customer_order_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_customer_order_drafts_updated_at BEFORE UPDATE ON public.customer_order_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customer_sessions set_customer_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_customer_sessions_updated_at BEFORE UPDATE ON public.customer_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers set_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenants set_default_tenant_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_default_tenant_settings AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.ensure_tenant_settings_defaults();


--
-- Name: employees set_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entry_tokens set_entry_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_entry_tokens_updated_at BEFORE UPDATE ON public.entry_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_items set_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_shelves set_inventory_shelves_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_inventory_shelves_updated_at BEFORE UPDATE ON public.inventory_shelves FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: landing_comments set_landing_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_landing_comments_updated_at BEFORE UPDATE ON public.landing_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_companies set_lead_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_companies_updated_at BEFORE UPDATE ON public.lead_companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_email_dispatches set_lead_email_dispatches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_email_dispatches_updated_at BEFORE UPDATE ON public.lead_email_dispatches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_email_sequence_enrollments set_lead_email_sequence_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_email_sequence_enrollments_updated_at BEFORE UPDATE ON public.lead_email_sequence_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_email_sequence_steps set_lead_email_sequence_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_email_sequence_steps_updated_at BEFORE UPDATE ON public.lead_email_sequence_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lead_email_sequences set_lead_email_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lead_email_sequences_updated_at BEFORE UPDATE ON public.lead_email_sequences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: loyalty_programs set_loyalty_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: loyalty_rewards set_loyalty_rewards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: marketing_assets set_marketing_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_marketing_assets_updated_at BEFORE UPDATE ON public.marketing_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: operation_boxes set_operation_boxes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_operation_boxes_updated_at BEFORE UPDATE ON public.operation_boxes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payment_intents set_payment_intents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_payment_intents_updated_at BEFORE UPDATE ON public.payment_intents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plans set_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: platform_admins set_platform_admins_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_platform_admins_updated_at BEFORE UPDATE ON public.platform_admins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: platform_settings set_platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rate_limits set_rate_limits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_quotes set_service_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_service_quotes_updated_at BEFORE UPDATE ON public.service_quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: services set_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_publications set_social_publications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_social_publications_updated_at BEFORE UPDATE ON public.social_publications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_tickets set_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_company_profiles set_tenant_company_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_company_profiles_updated_at BEFORE UPDATE ON public.tenant_company_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_growth_progress set_tenant_growth_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_growth_progress_updated_at BEFORE UPDATE ON public.tenant_growth_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_instagram_accounts set_tenant_instagram_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_instagram_accounts_updated_at BEFORE UPDATE ON public.tenant_instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_landing_media set_tenant_landing_media_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_landing_media_updated_at BEFORE UPDATE ON public.tenant_landing_media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_landing_pages set_tenant_landing_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_landing_pages_updated_at BEFORE UPDATE ON public.tenant_landing_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_reviews set_tenant_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_reviews_updated_at BEFORE UPDATE ON public.tenant_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_settings set_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenant_subscriptions set_tenant_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenant_subscriptions_updated_at BEFORE UPDATE ON public.tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenants set_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vehicles set_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: appointment_items appointment_items_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_items
    ADD CONSTRAINT appointment_items_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_items appointment_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_items
    ADD CONSTRAINT appointment_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: appointment_items appointment_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_items
    ADD CONSTRAINT appointment_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_payment_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_payment_intent_id_fkey FOREIGN KEY (payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: attendance_box_events attendance_box_events_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE CASCADE;


--
-- Name: attendance_box_events attendance_box_events_from_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_from_box_id_fkey FOREIGN KEY (from_box_id) REFERENCES public.operation_boxes(id) ON DELETE SET NULL;


--
-- Name: attendance_box_events attendance_box_events_moved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: attendance_box_events attendance_box_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: attendance_box_events attendance_box_events_to_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_box_events
    ADD CONSTRAINT attendance_box_events_to_box_id_fkey FOREIGN KEY (to_box_id) REFERENCES public.operation_boxes(id) ON DELETE SET NULL;


--
-- Name: attendance_media attendance_media_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_media
    ADD CONSTRAINT attendance_media_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE CASCADE;


--
-- Name: attendance_media attendance_media_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_media
    ADD CONSTRAINT attendance_media_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.operation_boxes(id) ON DELETE SET NULL;


--
-- Name: attendance_media attendance_media_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_media
    ADD CONSTRAINT attendance_media_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: attendance_media attendance_media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_media
    ADD CONSTRAINT attendance_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: attendance_public_status attendance_public_status_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_public_status
    ADD CONSTRAINT attendance_public_status_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE CASCADE;


--
-- Name: attendance_service_items attendance_service_items_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_service_items
    ADD CONSTRAINT attendance_service_items_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE CASCADE;


--
-- Name: attendance_service_items attendance_service_items_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_service_items
    ADD CONSTRAINT attendance_service_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: attendance_service_items attendance_service_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_service_items
    ADD CONSTRAINT attendance_service_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: attendance_service_items attendance_service_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_service_items
    ADD CONSTRAINT attendance_service_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_current_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_current_box_id_fkey FOREIGN KEY (current_box_id) REFERENCES public.operation_boxes(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: attendances attendances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_payment_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_payment_intent_id_fkey FOREIGN KEY (payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: attendances attendances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_actor_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_customer_id_fkey FOREIGN KEY (actor_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: cash_entries cash_entries_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: cash_entries cash_entries_cash_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;


--
-- Name: cash_entries cash_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: cash_entries cash_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: cash_sessions cash_sessions_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);


--
-- Name: cash_sessions cash_sessions_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES auth.users(id);


--
-- Name: cash_sessions cash_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_credentials customer_credentials_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_credentials customer_credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_credentials
    ADD CONSTRAINT customer_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_order_drafts customer_order_drafts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_order_drafts customer_order_drafts_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;


--
-- Name: customer_order_drafts customer_order_drafts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_order_drafts customer_order_drafts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_drafts
    ADD CONSTRAINT customer_order_drafts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: customer_sessions customer_sessions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_sessions customer_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customers customers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: employee_work_sessions employee_work_sessions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_work_sessions
    ADD CONSTRAINT employee_work_sessions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: employee_work_sessions employee_work_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_work_sessions
    ADD CONSTRAINT employee_work_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_work_sessions employee_work_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_work_sessions
    ADD CONSTRAINT employee_work_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: employees employees_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: employees employees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: entry_tokens entry_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_tokens
    ADD CONSTRAINT entry_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_shelf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.inventory_shelves(id) ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_shelf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.inventory_shelves(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_shelves inventory_shelves_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_shelves
    ADD CONSTRAINT inventory_shelves_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: landing_comments landing_comments_marketing_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_comments
    ADD CONSTRAINT landing_comments_marketing_asset_id_fkey FOREIGN KEY (marketing_asset_id) REFERENCES public.marketing_assets(id) ON DELETE CASCADE;


--
-- Name: landing_comments landing_comments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_comments
    ADD CONSTRAINT landing_comments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: landing_comments landing_comments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_comments
    ADD CONSTRAINT landing_comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: landing_likes landing_likes_marketing_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_likes
    ADD CONSTRAINT landing_likes_marketing_asset_id_fkey FOREIGN KEY (marketing_asset_id) REFERENCES public.marketing_assets(id) ON DELETE CASCADE;


--
-- Name: landing_likes landing_likes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_likes
    ADD CONSTRAINT landing_likes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: lead_analysis lead_analysis_lead_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_analysis
    ADD CONSTRAINT lead_analysis_lead_company_id_fkey FOREIGN KEY (lead_company_id) REFERENCES public.lead_companies(id) ON DELETE CASCADE;


--
-- Name: lead_company_activities lead_company_activities_lead_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_company_activities
    ADD CONSTRAINT lead_company_activities_lead_company_id_fkey FOREIGN KEY (lead_company_id) REFERENCES public.lead_companies(id) ON DELETE CASCADE;


--
-- Name: lead_email_dispatches lead_email_dispatches_lead_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_dispatches
    ADD CONSTRAINT lead_email_dispatches_lead_company_id_fkey FOREIGN KEY (lead_company_id) REFERENCES public.lead_companies(id) ON DELETE CASCADE;


--
-- Name: lead_email_dispatches lead_email_dispatches_lead_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_dispatches
    ADD CONSTRAINT lead_email_dispatches_lead_message_id_fkey FOREIGN KEY (lead_message_id) REFERENCES public.lead_messages(id) ON DELETE SET NULL;


--
-- Name: lead_email_sequence_enrollments lead_email_sequence_enrollments_lead_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_enrollments
    ADD CONSTRAINT lead_email_sequence_enrollments_lead_company_id_fkey FOREIGN KEY (lead_company_id) REFERENCES public.lead_companies(id) ON DELETE CASCADE;


--
-- Name: lead_email_sequence_enrollments lead_email_sequence_enrollments_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_enrollments
    ADD CONSTRAINT lead_email_sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.lead_email_sequences(id) ON DELETE CASCADE;


--
-- Name: lead_email_sequence_steps lead_email_sequence_steps_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_email_sequence_steps
    ADD CONSTRAINT lead_email_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.lead_email_sequences(id) ON DELETE CASCADE;


--
-- Name: lead_messages lead_messages_lead_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_messages
    ADD CONSTRAINT lead_messages_lead_company_id_fkey FOREIGN KEY (lead_company_id) REFERENCES public.lead_companies(id) ON DELETE CASCADE;


--
-- Name: loyalty_entries loyalty_entries_actor_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_actor_customer_id_fkey FOREIGN KEY (actor_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: loyalty_entries loyalty_entries_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_entries loyalty_entries_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: loyalty_entries loyalty_entries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_entries loyalty_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: loyalty_entries loyalty_entries_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_entries
    ADD CONSTRAINT loyalty_entries_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: loyalty_programs loyalty_programs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_programs loyalty_programs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.loyalty_entries(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: loyalty_rewards loyalty_rewards_used_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_used_attendance_id_fkey FOREIGN KEY (used_attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: loyalty_rewards loyalty_rewards_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: marketing_assets marketing_assets_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_assets marketing_assets_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: marketing_assets marketing_assets_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: marketing_assets marketing_assets_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.attendance_media(id) ON DELETE SET NULL;


--
-- Name: marketing_assets marketing_assets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_assets
    ADD CONSTRAINT marketing_assets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: message_dispatch_queue message_dispatch_queue_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_dispatch_queue
    ADD CONSTRAINT message_dispatch_queue_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: message_dispatch_queue message_dispatch_queue_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_dispatch_queue
    ADD CONSTRAINT message_dispatch_queue_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: message_dispatch_queue message_dispatch_queue_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_dispatch_queue
    ADD CONSTRAINT message_dispatch_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: operation_boxes operation_boxes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_boxes
    ADD CONSTRAINT operation_boxes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: payment_intents payment_intents_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: payment_intents payment_intents_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: platform_admins platform_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rate_limits rate_limits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: service_quotes service_quotes_approved_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_approved_attendance_id_fkey FOREIGN KEY (approved_attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;


--
-- Name: service_quotes service_quotes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: service_quotes service_quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: service_quotes service_quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: service_quotes service_quotes_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: service_quotes service_quotes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: service_quotes service_quotes_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: services services_base_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_base_service_id_fkey FOREIGN KEY (base_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: services services_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: social_publications social_publications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publications
    ADD CONSTRAINT social_publications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: social_publications social_publications_marketing_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publications
    ADD CONSTRAINT social_publications_marketing_asset_id_fkey FOREIGN KEY (marketing_asset_id) REFERENCES public.marketing_assets(id) ON DELETE CASCADE;


--
-- Name: social_publications social_publications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_publications
    ADD CONSTRAINT social_publications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_admin_reply_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_admin_reply_by_fkey FOREIGN KEY (admin_reply_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_company_profiles tenant_company_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_company_profiles
    ADD CONSTRAINT tenant_company_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_growth_progress tenant_growth_progress_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_growth_progress
    ADD CONSTRAINT tenant_growth_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_growth_progress tenant_growth_progress_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_growth_progress
    ADD CONSTRAINT tenant_growth_progress_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tenant_instagram_accounts tenant_instagram_accounts_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_instagram_accounts
    ADD CONSTRAINT tenant_instagram_accounts_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tenant_instagram_accounts tenant_instagram_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_instagram_accounts
    ADD CONSTRAINT tenant_instagram_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_landing_media tenant_landing_media_attendance_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_media
    ADD CONSTRAINT tenant_landing_media_attendance_media_id_fkey FOREIGN KEY (attendance_media_id) REFERENCES public.attendance_media(id) ON DELETE SET NULL;


--
-- Name: tenant_landing_media tenant_landing_media_marketing_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_media
    ADD CONSTRAINT tenant_landing_media_marketing_asset_id_fkey FOREIGN KEY (marketing_asset_id) REFERENCES public.marketing_assets(id) ON DELETE SET NULL;


--
-- Name: tenant_landing_media tenant_landing_media_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_media
    ADD CONSTRAINT tenant_landing_media_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_landing_pages tenant_landing_pages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_landing_pages
    ADD CONSTRAINT tenant_landing_pages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_reviews tenant_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_reviews
    ADD CONSTRAINT tenant_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_subscriptions tenant_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;


--
-- Name: tenant_subscriptions tenant_subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: vehicle_catalog_models vehicle_catalog_models_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_catalog_models
    ADD CONSTRAINT vehicle_catalog_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.vehicle_catalog_brands(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: attendance_public_status anon can read active public tracking status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon can read active public tracking status" ON public.attendance_public_status FOR SELECT TO anon USING ((is_active = true));


--
-- Name: appointment_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_items ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_box_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_box_events ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_media ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_public_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_public_status ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_service_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_service_items ENABLE ROW LEVEL SECURITY;

--
-- Name: attendances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_catalog_brands authenticated can read vehicle catalog brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read vehicle catalog brands" ON public.vehicle_catalog_brands FOR SELECT TO authenticated USING (true);


--
-- Name: vehicle_catalog_colors authenticated can read vehicle catalog colors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read vehicle catalog colors" ON public.vehicle_catalog_colors FOR SELECT TO authenticated USING (true);


--
-- Name: vehicle_catalog_models authenticated can read vehicle catalog models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read vehicle catalog models" ON public.vehicle_catalog_models FOR SELECT TO authenticated USING (true);


--
-- Name: cash_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_order_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_order_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_work_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_work_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: entry_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entry_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_shelves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_shelves ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_company_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_company_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_email_dispatches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_email_dispatches ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_email_sequence_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_email_sequence_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_email_sequence_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_email_sequence_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_email_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_email_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_hunter_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_hunter_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: message_dispatch_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_dispatch_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: operation_boxes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operation_boxes ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_media operators can insert own attendance media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators can insert own attendance media" ON public.attendance_media FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_media.attendance_id) AND (a.tenant_id = attendance_media.tenant_id) AND (public.current_tenant_role(a.tenant_id) = 'operator'::public.app_role) AND (a.employee_id = public.current_employee_id(a.tenant_id))))));


--
-- Name: attendances operators can update own attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators can update own attendances" ON public.attendances FOR UPDATE TO authenticated USING (((public.current_tenant_role(tenant_id) = 'operator'::public.app_role) AND (employee_id = public.current_employee_id(tenant_id)))) WITH CHECK (((public.current_tenant_role(tenant_id) = 'operator'::public.app_role) AND (employee_id = public.current_employee_id(tenant_id))));


--
-- Name: attendance_public_status operators can update own public tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators can update own public tracking" ON public.attendance_public_status FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND (public.current_tenant_role(a.tenant_id) = 'operator'::public.app_role) AND (a.employee_id = public.current_employee_id(a.tenant_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND (public.current_tenant_role(a.tenant_id) = 'operator'::public.app_role) AND (a.employee_id = public.current_employee_id(a.tenant_id))))));


--
-- Name: attendance_media owners managers can insert attendance media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert attendance media" ON public.attendance_media FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_company_profiles owners managers can insert company profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert company profile" ON public.tenant_company_profiles FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_instagram_accounts owners managers can insert instagram accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert instagram accounts" ON public.tenant_instagram_accounts FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: inventory_movements owners managers can insert inventory movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert inventory movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: loyalty_entries owners managers can insert loyalty entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert loyalty entries" ON public.loyalty_entries FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: loyalty_programs owners managers can insert loyalty programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert loyalty programs" ON public.loyalty_programs FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: marketing_assets owners managers can insert marketing assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert marketing assets" ON public.marketing_assets FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: operation_boxes owners managers can insert operation boxes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert operation boxes" ON public.operation_boxes FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: social_publications owners managers can insert social publications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert social publications" ON public.social_publications FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: support_tickets owners managers can insert support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert support tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK ((public.is_tenant_member(tenant_id) AND (created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.tenant_users tu
  WHERE ((tu.tenant_id = support_tickets.tenant_id) AND (tu.user_id = auth.uid()) AND (tu.is_active = true) AND (tu.role = ANY (ARRAY['owner'::public.app_role, 'manager'::public.app_role])))))));


--
-- Name: tenant_settings owners managers can insert tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can insert tenant settings" ON public.tenant_settings FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: inventory_items owners managers can manage inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage inventory items" ON public.inventory_items TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: inventory_shelves owners managers can manage inventory shelves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage inventory shelves" ON public.inventory_shelves TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_landing_media owners managers can manage landing media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage landing media" ON public.tenant_landing_media TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_reviews owners managers can manage reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage reviews" ON public.tenant_reviews TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: service_quotes owners managers can manage service quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage service quotes" ON public.service_quotes TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_growth_progress owners managers can manage tenant growth progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can manage tenant growth progress" ON public.tenant_growth_progress TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_instagram_accounts owners managers can read instagram accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can read instagram accounts" ON public.tenant_instagram_accounts FOR SELECT TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: landing_comments owners managers can review landing comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can review landing comments" ON public.landing_comments FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: appointments owners managers can update appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: attendances owners managers can update attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update attendances" ON public.attendances FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: cash_entries owners managers can update cash entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update cash entries" ON public.cash_entries FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: cash_sessions owners managers can update cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update cash sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_company_profiles owners managers can update company profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update company profile" ON public.tenant_company_profiles FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: customers owners managers can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: employees owners managers can update employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update employees" ON public.employees FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_instagram_accounts owners managers can update instagram accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update instagram accounts" ON public.tenant_instagram_accounts FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: loyalty_entries owners managers can update loyalty entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update loyalty entries" ON public.loyalty_entries FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: loyalty_programs owners managers can update loyalty programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update loyalty programs" ON public.loyalty_programs FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: loyalty_rewards owners managers can update loyalty rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update loyalty rewards" ON public.loyalty_rewards FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: marketing_assets owners managers can update marketing assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update marketing assets" ON public.marketing_assets FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: operation_boxes owners managers can update operation boxes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update operation boxes" ON public.operation_boxes FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: attendance_public_status owners managers can update public tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update public tracking" ON public.attendance_public_status FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND public.is_tenant_owner_or_manager(a.tenant_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND public.is_tenant_owner_or_manager(a.tenant_id)))));


--
-- Name: services owners managers can update services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update services" ON public.services FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: social_publications owners managers can update social publications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update social publications" ON public.social_publications FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_settings owners managers can update tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update tenant settings" ON public.tenant_settings FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: vehicles owners managers can update vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: tenant_landing_pages owners managers can upsert landing page; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners managers can upsert landing page" ON public.tenant_landing_pages TO authenticated USING (public.is_tenant_owner_or_manager(tenant_id)) WITH CHECK (public.is_tenant_owner_or_manager(tenant_id));


--
-- Name: payment_intents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_admins platform admins can read own admin record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "platform admins can read own admin record" ON public.platform_admins FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND (is_active = true)));


--
-- Name: platform_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles are inserted by self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles are inserted by self" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles are updated by self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles are updated by self" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles are visible to self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles are visible to self" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: service_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: social_publications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: message_dispatch_queue tenant members can read their own message dispatch queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant members can read their own message dispatch queue" ON public.message_dispatch_queue FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tenant_users m
  WHERE ((m.tenant_id = message_dispatch_queue.tenant_id) AND (m.user_id = auth.uid()) AND (m.is_active = true)))));


--
-- Name: appointments tenant users can insert appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: attendances tenant users can insert attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert attendances" ON public.attendances FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: cash_entries tenant users can insert cash entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert cash entries" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: cash_sessions tenant users can insert cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert cash sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: customers tenant users can insert customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: employees tenant users can insert employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: attendance_public_status tenant users can insert public tracking status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert public tracking status" ON public.attendance_public_status FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND public.is_tenant_member(a.tenant_id)))));


--
-- Name: services tenant users can insert services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: vehicles tenant users can insert vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: appointment_items tenant users can manage appointment items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can manage appointment items" ON public.appointment_items TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: attendance_service_items tenant users can manage attendance service items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can manage attendance service items" ON public.attendance_service_items USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));


--
-- Name: appointments tenant users can read appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: attendance_box_events tenant users can read attendance box events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read attendance box events" ON public.attendance_box_events FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: attendance_media tenant users can read attendance media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read attendance media" ON public.attendance_media FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: attendance_service_items tenant users can read attendance service items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read attendance service items" ON public.attendance_service_items FOR SELECT USING (public.is_tenant_member(tenant_id));


--
-- Name: attendances tenant users can read attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read attendances" ON public.attendances FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: cash_entries tenant users can read cash entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read cash entries" ON public.cash_entries FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: cash_sessions tenant users can read cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read cash sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_company_profiles tenant users can read company profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read company profile" ON public.tenant_company_profiles FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: customers tenant users can read customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: employee_work_sessions tenant users can read employee work sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read employee work sessions" ON public.employee_work_sessions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: employees tenant users can read employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read employees" ON public.employees FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: inventory_items tenant users can read inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read inventory items" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: inventory_movements tenant users can read inventory movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read inventory movements" ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: inventory_shelves tenant users can read inventory shelves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read inventory shelves" ON public.inventory_shelves FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: landing_comments tenant users can read landing comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read landing comments" ON public.landing_comments FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: landing_likes tenant users can read landing likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read landing likes" ON public.landing_likes FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_landing_media tenant users can read landing media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read landing media" ON public.tenant_landing_media FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_landing_pages tenant users can read landing page; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read landing page" ON public.tenant_landing_pages FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: loyalty_entries tenant users can read loyalty entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read loyalty entries" ON public.loyalty_entries FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: loyalty_programs tenant users can read loyalty programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read loyalty programs" ON public.loyalty_programs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: loyalty_rewards tenant users can read loyalty rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read loyalty rewards" ON public.loyalty_rewards FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: marketing_assets tenant users can read marketing assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read marketing assets" ON public.marketing_assets FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: operation_boxes tenant users can read operation boxes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read operation boxes" ON public.operation_boxes FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_users tenant users can read own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read own membership" ON public.tenant_users FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: payment_intents tenant users can read payment intents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read payment intents" ON public.payment_intents FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: attendance_public_status tenant users can read public tracking status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read public tracking status" ON public.attendance_public_status FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.attendances a
  WHERE ((a.id = attendance_public_status.attendance_id) AND public.is_tenant_member(a.tenant_id)))));


--
-- Name: tenant_reviews tenant users can read reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read reviews" ON public.tenant_reviews FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: service_quotes tenant users can read service quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read service quotes" ON public.service_quotes FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: services tenant users can read services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read services" ON public.services FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: social_publications tenant users can read social publications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read social publications" ON public.social_publications FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: support_tickets tenant users can read support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_growth_progress tenant users can read tenant growth progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read tenant growth progress" ON public.tenant_growth_progress FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_settings tenant users can read tenant settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read tenant settings" ON public.tenant_settings FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenants tenant users can read their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read their tenants" ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id));


--
-- Name: vehicles tenant users can read vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant users can read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));


--
-- Name: tenant_company_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_company_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_growth_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_growth_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_instagram_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_instagram_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_landing_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_landing_media ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_landing_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_landing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_catalog_brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_catalog_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_catalog_colors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_catalog_colors ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_catalog_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_catalog_models ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 3R6uwAQ6Hd1rbAKVOvqGqI3oDGEOzN1ncqMG2L4oNKDyZSrOk8pXtUzcsQFzGMe

