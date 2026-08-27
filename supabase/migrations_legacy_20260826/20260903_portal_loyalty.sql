-- Portal do Cliente — Fidelidade por veículo (§7).
-- Programa configurável por tenant; entradas auditáveis por vehicle_id; recompensas com
-- state machine (generated -> available -> used | reverted | canceled).
-- Decisão aprovada: sem prova de pagamento; elegibilidade por conclusão (status='delivered')
-- + eligibility_rule configurável. Concessão somente via RPC backend (award_loyalty_wash),
-- transacional e idempotente.

-- Conformidade (§11): loyalty_programs (uuid, tenant_id, created_at, updated_at, created_by;
-- soft delete equivalente via is_active), loyalty_entries (append-only: updated_at N/A; autor via
-- actor_customer_id/actor_user_id; reversão via kind/status, nunca DELETE), loyalty_rewards
-- (autor N/A — gerado pelo sistema; lifecycle por status: generated/available/used/reverted/canceled).
create table if not exists public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null default 'Fidelidade',
  washes_required integer not null default 10 check (washes_required >= 1),
  reward_type text not null default 'free_wash',
  eligibility_rule text not null default 'concluded'
    check (eligibility_rule in ('concluded', 'concluded_and_paid')),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists loyalty_programs_one_active_per_tenant_idx
  on public.loyalty_programs (tenant_id)
  where is_active = true;

drop trigger if exists set_loyalty_programs_updated_at on public.loyalty_programs;
create trigger set_loyalty_programs_updated_at
before update on public.loyalty_programs
for each row execute function public.set_updated_at();

create table if not exists public.loyalty_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  attendance_id uuid references public.attendances (id) on delete set null,
  kind text not null default 'wash' check (kind in ('wash', 'adjustment', 'reversal')),
  wash_number integer not null check (wash_number >= 1),
  cycle_started_at date not null,
  event_date timestamptz not null default timezone('utc', now()),
  source text not null check (source in ('attendance_delivered', 'portal', 'operator', 'system')),
  actor_customer_id uuid references public.customers (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  reversal_reason text,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists loyalty_entries_one_per_attendance_idx
  on public.loyalty_entries (tenant_id, vehicle_id, attendance_id)
  where attendance_id is not null;

create index if not exists loyalty_entries_vehicle_wash_number_idx
  on public.loyalty_entries (tenant_id, vehicle_id, wash_number);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  entry_id uuid not null references public.loyalty_entries (id) on delete cascade,
  status text not null default 'generated'
    check (status in ('generated', 'available', 'used', 'reverted', 'canceled')),
  used_attendance_id uuid references public.attendances (id) on delete set null,
  used_at timestamptz,
  reverted_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists loyalty_rewards_vehicle_status_idx
  on public.loyalty_rewards (tenant_id, vehicle_id, status);

drop trigger if exists set_loyalty_rewards_updated_at on public.loyalty_rewards;
create trigger set_loyalty_rewards_updated_at
before update on public.loyalty_rewards
for each row execute function public.set_updated_at();

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_entries enable row level security;
alter table public.loyalty_rewards enable row level security;

-- Concessão de fidelidade: somente backend (service_role), transacional e idempotente.
-- Ciclos de washes_required: a posição (wash_number) é calculada em módulo do total de
-- lavagens elegíveis; recompensa é gerada apenas na posição final do ciclo (ex.: 10ª, 20ª).
create or replace function public.award_loyalty_wash(p_attendance_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.award_loyalty_wash(uuid) from public;
grant execute on function public.award_loyalty_wash(uuid) to service_role;
