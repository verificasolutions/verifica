-- Portal do Cliente — Extensão de veículos (§5).
-- Tipo de uso (decisão aprovada: text+CHECK, expansível por tenant), porte resolvido,
-- origem da classificação/do cadastro, confirmação do cliente e última atualização dos dados.
-- Sem tabela de vínculo separada: vehicles já carrega customer_id (multi-veículo por cliente).

alter table public.vehicles
  add column if not exists usage_type text not null default 'particular',
  add column if not exists size_tier text,
  add column if not exists tier_source text,
  add column if not exists vehicle_source text not null default 'operator',
  add column if not exists confirmed_at timestamptz,
  add column if not exists last_vehicle_data_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_usage_type_check') then
    alter table public.vehicles
      add constraint vehicles_usage_type_check
      check (usage_type in ('particular', 'app_driver', 'taxi', 'company', 'other_professional'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vehicles_size_tier_check') then
    alter table public.vehicles
      add constraint vehicles_size_tier_check
      check (size_tier is null or size_tier in ('passeio', 'medio', 'grande', 'bem_grande'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vehicles_tier_source_check') then
    alter table public.vehicles
      add constraint vehicles_tier_source_check
      check (tier_source is null or tier_source in ('engine', 'lookup', 'manual'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vehicles_vehicle_source_check') then
    alter table public.vehicles
      add constraint vehicles_vehicle_source_check
      check (vehicle_source in ('operator', 'portal', 'lookup'));
  end if;
end
$$;

create index if not exists vehicles_tenant_customer_active_idx
  on public.vehicles (tenant_id, customer_id, is_active);
