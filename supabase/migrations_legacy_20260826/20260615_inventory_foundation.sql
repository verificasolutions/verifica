create table if not exists public.inventory_shelves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text,
  note text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists inventory_shelves_tenant_sort_idx
on public.inventory_shelves (tenant_id, sort_order asc, created_at asc);

create unique index if not exists inventory_shelves_tenant_name_uidx
on public.inventory_shelves (tenant_id, lower(name))
where is_active = true;

drop trigger if exists set_inventory_shelves_updated_at on public.inventory_shelves;
create trigger set_inventory_shelves_updated_at
before update on public.inventory_shelves
for each row execute function public.set_updated_at();

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  shelf_id uuid not null references public.inventory_shelves (id) on delete restrict,
  name text not null,
  brand text,
  barcode text,
  sku text,
  category text,
  supplier text,
  unit text not null default 'un',
  quantity numeric(12, 3) not null default 0,
  min_quantity numeric(12, 3) not null default 0,
  cost_price numeric(12, 2) not null default 0,
  sale_price numeric(12, 2) not null default 0,
  package_size text,
  location_label text,
  batch_code text,
  expiration_date date,
  notes text,
  last_entry_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists inventory_items_tenant_shelf_idx
on public.inventory_items (tenant_id, shelf_id, created_at desc);

create unique index if not exists inventory_items_tenant_barcode_uidx
on public.inventory_items (tenant_id, barcode)
where barcode is not null and length(trim(barcode)) > 0;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  shelf_id uuid not null references public.inventory_shelves (id) on delete cascade,
  kind text not null check (kind in ('initial', 'in', 'out')),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2),
  note text,
  source text not null default 'manual',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists inventory_movements_tenant_created_idx
on public.inventory_movements (tenant_id, created_at desc);

create or replace function public.inventory_register_movement(
  p_tenant_id uuid,
  p_item_id uuid,
  p_kind text,
  p_quantity numeric,
  p_note text default null,
  p_unit_cost numeric default null,
  p_source text default 'manual'
)
returns numeric
language plpgsql
security invoker
as $$
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

alter table public.inventory_shelves enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

grant select, insert, update on public.inventory_shelves to authenticated;
grant select, insert, update on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant execute on function public.inventory_register_movement(uuid, uuid, text, numeric, text, numeric, text) to authenticated;

drop policy if exists "tenant users can read inventory shelves" on public.inventory_shelves;
create policy "tenant users can read inventory shelves"
on public.inventory_shelves
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage inventory shelves" on public.inventory_shelves;
create policy "owners managers can manage inventory shelves"
on public.inventory_shelves
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read inventory items" on public.inventory_items;
create policy "tenant users can read inventory items"
on public.inventory_items
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage inventory items" on public.inventory_items;
create policy "owners managers can manage inventory items"
on public.inventory_items
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

drop policy if exists "tenant users can read inventory movements" on public.inventory_movements;
create policy "tenant users can read inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can insert inventory movements" on public.inventory_movements;
create policy "owners managers can insert inventory movements"
on public.inventory_movements
for insert
to authenticated
with check (public.is_tenant_owner_or_manager(tenant_id));
