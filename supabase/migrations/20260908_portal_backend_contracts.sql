-- Fase 3 — Contratos de backend do portal: entry tokens (anti-enumeração), drafts de
-- contratação (idempotência por tentativa retida no servidor), registro de cliente com
-- tenant derivado do token (nunca escolhido pelo chamador anônimo), leitura de ordens sem
-- dados financeiros e confirmação de agendamento com validação server-side + conflito
-- de horário DENTRO da transação. Eventos obrigatórios gravados atomicamente (audit_logs).

-- 1) entry_tokens — vínculo tenant+telefone+placa; TTL curto; uso único (consumed_at) --------
create table if not exists public.entry_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  phone_normalized text not null,
  plate_normalized text not null,
  purpose text not null default 'entry' check (purpose in ('entry')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists entry_tokens_tenant_expires_idx
  on public.entry_tokens (tenant_id, expires_at);

drop trigger if exists set_entry_tokens_updated_at on public.entry_tokens;
create trigger set_entry_tokens_updated_at
before update on public.entry_tokens
for each row execute function public.set_updated_at();

alter table public.entry_tokens enable row level security;
-- Sem grants: somente server-side (admin client) + validação no server action.

-- 2) customer_order_drafts — tentativa retida no servidor; consumível UMA única vez -----------
create table if not exists public.customer_order_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null default 'order' check (kind in ('order', 'appointment')),
  service_ids uuid[] not null,
  reward_id uuid references public.loyalty_rewards (id) on delete set null,
  idempotency_key uuid not null unique,
  session_token_hash text not null,
  status text not null default 'open' check (status in ('open', 'used', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customer_order_drafts_tenant_idempotency_idx
  on public.customer_order_drafts (tenant_id, idempotency_key);

create index if not exists customer_order_drafts_customer_expires_idx
  on public.customer_order_drafts (customer_id, expires_at);

drop trigger if exists set_customer_order_drafts_updated_at on public.customer_order_drafts;
create trigger set_customer_order_drafts_updated_at
before update on public.customer_order_drafts
for each row execute function public.set_updated_at();

alter table public.customer_order_drafts enable row level security;
-- Sem grants: somente server-side (admin client). Conformidade: uuid, tenant_id, created_at,
-- updated_at; created_by N/A (autor = cliente via FK customer_id); soft delete via status/expiry.

-- 3) appointments: idempotência por tentativa + vínculo com intent ----------------------------
alter table public.appointments
  add column if not exists idempotency_key text,
  add column if not exists payment_intent_id uuid references public.payment_intents (id) on delete set null;

create unique index if not exists appointments_tenant_idempotency_key_idx
  on public.appointments (tenant_id, idempotency_key)
  where idempotency_key is not null;

-- 4) payment_intents: vínculo opcional com agendamento -----------------------------------------
alter table public.payment_intents
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null;

create index if not exists payment_intents_appointment_idx
  on public.payment_intents (appointment_id);

-- 5) Registro de cliente — RPC restrita a service_role: valida/consome o entry token
--    SERVER-SIDE (tenant, telefone e placa vêm do registro, nunca do chamador). anon/
--    authenticated REVOGADOS — a superfície pública nunca escolhe tenant arbitrário.
--    Cliente + credencial scrypt + audit customer.register na MESMA transação (sem órfãos).
create or replace function public.customer_register(p_entry_token_hash text, p_name text, p_password_hash text)
returns table (id uuid, tenant_id uuid, name text, phone_normalized text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.customer_register(text, text, text) from public;
grant execute on function public.customer_register(text, text, text) to service_role;

-- 5b) Sessão + audit login atômicos (server-side; service_role) -------------------------------
create or replace function public.customer_session_create_log(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_created_ip inet,
  p_user_agent text,
  p_entry_token_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.customer_session_create_log(uuid, uuid, text, timestamptz, inet, text, uuid) from public;
grant execute on function public.customer_session_create_log(uuid, uuid, text, timestamptz, inet, text, uuid) to service_role;

-- 5c) Logout + audit atômicos (server-side; service_role) -------------------------------------
create or replace function public.customer_session_revoke_log(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.customer_session_revoke_log(text) from public;
grant execute on function public.customer_session_revoke_log(text) to service_role;

-- 5d) Draft + audit atômicos (server-side; service_role) --------------------------------------
create or replace function public.customer_order_draft_create(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_kind text,
  p_service_ids uuid[],
  p_reward_id uuid,
  p_idempotency_key uuid,
  p_session_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.customer_order_draft_create(uuid, uuid, uuid, text, uuid[], uuid, uuid, text, timestamptz) from public;
grant execute on function public.customer_order_draft_create(uuid, uuid, uuid, text, uuid[], uuid, uuid, text, timestamptz) to service_role;

-- A imagem Supabase concede EXECUTE padrão a anon/authenticated em funções novas; revogamos
-- EXPLICITAMENTE (defesa em profundidade) nas RPCs de service_role. A validação do entry token
-- server-side já impede escolha arbitrária de tenant; o revoke fecha a superfície pública.
revoke execute on function public.customer_register(text, text, text) from anon, authenticated;
revoke execute on function public.customer_session_create_log(uuid, uuid, text, timestamptz, inet, text, uuid) from anon, authenticated;
revoke execute on function public.customer_session_revoke_log(text) from anon, authenticated;
revoke execute on function public.customer_order_draft_create(uuid, uuid, uuid, text, uuid[], uuid, uuid, text, timestamptz) from anon, authenticated;

-- 6) Ordens do cliente — SEM dados financeiros (nunca total gasto/acumulado) ------------------
create or replace function public.customer_orders(p_token_hash text, p_vehicle_id uuid)
returns table (
  id uuid, tenant_id uuid, vehicle_id uuid, status text, public_code text,
  estimated_minutes integer, created_at timestamptz, service_summary text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.customer_orders(text, uuid) from public;
grant execute on function public.customer_orders(text, uuid) to anon, authenticated;

-- 7) Confirmação de agendamento — preço/duração server-side, ownership, tenant, serviços
--    ativos e conflito de horário validados DENTRO da transação; p_scheduled_for é
--    revalidado (futuro, janela, disponibilidade). Evento gravado atomicamente. ---------------
create or replace function public.customer_confirm_appointment(
  p_token_hash text,
  p_vehicle_id uuid,
  p_service_ids uuid[],
  p_scheduled_for timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.customer_confirm_appointment(text, uuid, uuid[], timestamptz, uuid) from public;
grant execute on function public.customer_confirm_appointment(text, uuid, uuid[], timestamptz, uuid) to anon, authenticated;
