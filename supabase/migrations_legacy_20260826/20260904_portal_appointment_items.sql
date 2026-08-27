-- Portal do Cliente — Snapshot imutável de itens e valor de agendamento (§9).
-- appointments (schema legado) guarda um único service_id sem preço: extensão mínima com
-- total_price + tabela de itens espelhando attendance_service_items (padrão existente).

alter table public.appointments
  add column if not exists total_price numeric(10, 2) not null default 0;

-- Conformidade (§11): uuid, tenant_id, created_at. updated_at/created_by N/A (snapshot imutável);
-- soft delete N/A (vida ligada ao agendamento via on delete cascade).
create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name text not null,
  unit_price numeric(10, 2) not null default 0,
  estimated_minutes integer,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists appointment_items_appointment_sort_idx
  on public.appointment_items (appointment_id, sort_order);

-- Um item primário por agendamento (mesmo padrão de attendance_service_items).
create unique index if not exists appointment_items_primary_unique
  on public.appointment_items (appointment_id)
  where is_primary = true;

alter table public.appointment_items enable row level security;
