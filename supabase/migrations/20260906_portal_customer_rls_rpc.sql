-- Portal do Cliente — RLS (políticas internas), RPCs de cliente e rate limit.
-- Princípio: cliente NUNCA acessa tabelas; acesso somente via RPCs security definer que
-- validam o token de sessão (token_hash). Internos seguem o RLS existente (is_tenant_member).
-- Toda RPC: set search_path = public, pg_temp; revoke all from public; grants seletivos.
-- Preço/duração/itens são SEMPRE calculados no servidor a partir dos IDs e das configurações
-- do tenant; nenhum valor crítico enviado pelo cliente é confiado (customer_confirm_order
-- recebe apenas service_ids + idempotency_key + recompensa opcional).

-- 1) Grants + policies internas nas tabelas novas --------------------------------------------
grant select, insert, update on public.loyalty_programs to authenticated;
grant select, insert, update on public.loyalty_entries to authenticated;
grant select, insert, update on public.loyalty_rewards to authenticated;
grant select on public.payment_intents to authenticated;
grant select, insert, update on public.appointment_items to authenticated;

drop policy if exists "tenant users can read loyalty programs" on public.loyalty_programs;
create policy "tenant users can read loyalty programs"
on public.loyalty_programs
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert loyalty programs" on public.loyalty_programs;
create policy "owners managers can insert loyalty programs"
on public.loyalty_programs
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update loyalty programs" on public.loyalty_programs;
create policy "owners managers can update loyalty programs"
on public.loyalty_programs
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read loyalty entries" on public.loyalty_entries;
create policy "tenant users can read loyalty entries"
on public.loyalty_entries
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert loyalty entries" on public.loyalty_entries;
create policy "owners managers can insert loyalty entries"
on public.loyalty_entries
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "owners managers can update loyalty entries" on public.loyalty_entries;
create policy "owners managers can update loyalty entries"
on public.loyalty_entries
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read loyalty rewards" on public.loyalty_rewards;
create policy "tenant users can read loyalty rewards"
on public.loyalty_rewards
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can update loyalty rewards" on public.loyalty_rewards;
create policy "owners managers can update loyalty rewards"
on public.loyalty_rewards
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read payment intents" on public.payment_intents;
create policy "tenant users can read payment intents"
on public.payment_intents
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "tenant users can manage appointment items" on public.appointment_items;
create policy "tenant users can manage appointment items"
on public.appointment_items
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

-- 2) Rate limit (server-side; sem grants ao cliente) ------------------------------------------
create or replace function public.rate_limit_increment(p_tenant_id uuid, p_key text, p_window_seconds integer)
returns table (current_count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.rate_limit_increment(uuid, text, integer) from public;
grant execute on function public.rate_limit_increment(uuid, text, integer) to service_role;

-- 3) Helper de sessão (uso interno das demais funções; sem grant público) ---------------------
create or replace function public.customer_session_uid(p_token_hash text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cs.customer_id
  from public.customer_sessions cs
  where cs.token_hash = p_token_hash
    and cs.revoked_at is null
    and cs.expires_at > timezone('utc', now());
$$;

revoke all on function public.customer_session_uid(text) from public;

-- 4) Motor interno de porte (mesmo mapeamento de src/backend/shared/vehicle-catalog.ts;
--    revisável via tenant_settings.vehicle_type_tier_overrides) --------------------------------
create or replace function public.resolve_vehicle_size_tier(p_vehicle_type text, p_overrides jsonb)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(p_overrides ->> p_vehicle_type, ''),
    case p_vehicle_type
      when 'hatch' then 'passeio'
      when 'sedan' then 'medio'
      when 'wagon' then 'medio'
      when 'pickup_small' then 'grande'
      when 'suv' then 'grande'
      when 'pickup_large' then 'grande'
      when 'van' then 'grande'
      when 'micro_bus' then 'grande'
      when 'truck' then 'bem_grande'
      when 'bus' then 'bem_grande'
      else 'passeio'
    end
  );
$$;

revoke all on function public.resolve_vehicle_size_tier(text, jsonb) from public;

-- 5) RPCs de cliente --------------------------------------------------------------------------

create or replace function public.customer_current(p_token_hash text)
returns table (
  customer_id uuid,
  tenant_id uuid,
  name text,
  phone_normalized text,
  tenant_slug text,
  tenant_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_list_vehicles(p_token_hash text)
returns table (
  id uuid, tenant_id uuid, customer_id uuid, plate text, brand text, model text,
  color text, vehicle_type text, usage_type text, size_tier text, tier_source text,
  vehicle_source text, confirmed_at timestamptz, last_vehicle_data_at timestamptz, is_active boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_link_vehicle(
  p_token_hash text,
  p_plate text,
  p_brand text,
  p_model text,
  p_color text,
  p_vehicle_type text,
  p_usage_type text,
  p_size_tier text,
  p_tier_source text,
  p_vehicle_source text
)
returns table (
  id uuid, tenant_id uuid, customer_id uuid, plate text, brand text, model text,
  color text, vehicle_type text, usage_type text, size_tier text, tier_source text,
  vehicle_source text, confirmed_at timestamptz, last_vehicle_data_at timestamptz, is_active boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_unlink_vehicle(p_token_hash text, p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_list_services(p_token_hash text)
returns table (
  id uuid, name text, short_description text, kind public.service_kind,
  base_service_id uuid, sort_order integer,
  price numeric, price_passeio numeric, price_medio numeric, price_grande numeric, price_bem_grande numeric,
  price_app_passeio numeric, price_app_medio numeric, price_app_grande numeric, price_app_bem_grande numeric,
  addon_price_passeio numeric, addon_price_medio numeric, addon_price_grande numeric, addon_price_bem_grande numeric,
  addon_price_app_passeio numeric, addon_price_app_medio numeric, addon_price_app_grande numeric, addon_price_app_bem_grande numeric,
  minutes_passeio integer, minutes_medio integer, minutes_grande integer, minutes_bem_grande integer,
  addon_minutes integer, addon_minutes_passeio integer, addon_minutes_medio integer, addon_minutes_grande integer, addon_minutes_bem_grande integer,
  average_minutes integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_loyalty_summary(p_token_hash text, p_vehicle_id uuid)
returns table (
  program_id uuid, washes_required integer, washes_completed integer,
  reward_id uuid, reward_status text, reward_used_at timestamptz, cycle_started_at date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

create or replace function public.customer_payment_intents(p_token_hash text)
returns table (
  id uuid, tenant_id uuid, attendance_id uuid, amount numeric, status text,
  payment_method text, created_at timestamptz, succeeded_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

-- 6) Confirmação da contratação — preço, duração e itens calculados SOMENTE no servidor.
--    Recebe apenas: service_ids (1 principal + até 3 complementos), idempotency_key e
--    recompensa opcional. Nenhum preço/nome/duração enviado pelo cliente é confiado.
--    Uma única ordem, transacional, idempotente, auditada (evento order.created na Fase 3)
--    e com entrada imediata no grid operacional.
create or replace function public.customer_confirm_order(
  p_token_hash text,
  p_vehicle_id uuid,
  p_service_ids uuid[],
  p_idempotency_key uuid,
  p_reward_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  -- 4) validação dos IDs (1 principal + até 3 complementos; sem duplicatas)
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

-- Grants das RPCs de cliente (revoke-all + execute para anon/authenticated; a autorização
-- é o token de sessão validado dentro de cada função).
revoke all on function public.customer_current(text) from public;
grant execute on function public.customer_current(text) to anon, authenticated;

revoke all on function public.customer_list_vehicles(text) from public;
grant execute on function public.customer_list_vehicles(text) to anon, authenticated;

revoke all on function public.customer_link_vehicle(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.customer_link_vehicle(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

revoke all on function public.customer_unlink_vehicle(text, uuid) from public;
grant execute on function public.customer_unlink_vehicle(text, uuid) to anon, authenticated;

revoke all on function public.customer_list_services(text) from public;
grant execute on function public.customer_list_services(text) to anon, authenticated;

revoke all on function public.customer_loyalty_summary(text, uuid) from public;
grant execute on function public.customer_loyalty_summary(text, uuid) to anon, authenticated;

revoke all on function public.customer_payment_intents(text) from public;
grant execute on function public.customer_payment_intents(text) to anon, authenticated;

revoke all on function public.customer_confirm_order(text, uuid, uuid[], uuid, uuid) from public;
grant execute on function public.customer_confirm_order(text, uuid, uuid[], uuid, uuid) to anon, authenticated;
