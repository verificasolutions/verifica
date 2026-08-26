-- First portal access collects the minimum vehicle data and creates the vehicle atomically.
create or replace function public.customer_register(
  p_entry_token_hash text,
  p_name text,
  p_vehicle_model text,
  p_vehicle_type text,
  p_vehicle_color text,
  p_password_hash text
)
returns table (id uuid, tenant_id uuid, name text, phone_normalized text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.entry_tokens%rowtype;
  v_customer public.customers%rowtype;
begin
  if p_entry_token_hash is null or btrim(coalesce(p_name, '')) = ''
     or btrim(coalesce(p_vehicle_model, '')) = ''
     or btrim(coalesce(p_vehicle_type, '')) = ''
     or btrim(coalesce(p_vehicle_color, '')) = '' then
    raise exception 'Dados inválidos.';
  end if;

  if p_password_hash is null or p_password_hash = '' or p_password_hash !~ '^scrypt\$' then
    raise exception 'Hash de senha inválido.';
  end if;

  update public.entry_tokens
  set consumed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where token_hash = p_entry_token_hash
    and consumed_at is null
    and expires_at > timezone('utc', now())
  returning * into v_token;

  if v_token.id is null then raise exception 'Token de entrada inválido ou expirado.'; end if;
  if not exists (select 1 from public.tenants t where t.id = v_token.tenant_id and t.is_active = true) then
    raise exception 'Tenant inválido.';
  end if;

  insert into public.customers (tenant_id, name, whatsapp, phone_normalized, is_active)
  values (v_token.tenant_id, btrim(p_name), v_token.phone_normalized, v_token.phone_normalized, true)
  returning * into v_customer;

  insert into public.vehicles (
    tenant_id, customer_id, plate, model, color, vehicle_type,
    usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active
  ) values (
    v_customer.tenant_id, v_customer.id, v_token.plate_normalized, btrim(p_vehicle_model),
    btrim(p_vehicle_color), btrim(p_vehicle_type), 'particular',
    case when btrim(p_vehicle_type) = 'pickup' then 'grande'
         else public.resolve_vehicle_size_tier(btrim(p_vehicle_type), '{}'::jsonb)
    end, 'operator', 'portal',
    timezone('utc', now()), timezone('utc', now()), true
  );

  insert into public.customer_credentials (customer_id, tenant_id, password_hash)
  values (v_customer.id, v_customer.tenant_id, p_password_hash);

  insert into public.audit_logs (
    actor_user_id, actor_email, actor_customer_id, actor_role, tenant_id,
    action, entity_type, entity_id, message, metadata
  ) values (
    null, null, v_customer.id, 'customer', v_customer.tenant_id,
    'customer.register', 'customer', v_customer.id,
    'Cliente e veículo registrados pelo portal', jsonb_build_object('plate', v_token.plate_normalized)
  );

  return query select v_customer.id, v_customer.tenant_id, v_customer.name, v_customer.phone_normalized;
end;
$$;

revoke all on function public.customer_register(text, text, text, text, text, text) from public;
grant execute on function public.customer_register(text, text, text, text, text, text) to service_role;
