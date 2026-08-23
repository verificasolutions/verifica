import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InventoryShelfRecord = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryItemRecord = {
  id: string;
  tenant_id: string;
  shelf_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  supplier: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_price: number;
  sale_price: number;
  package_size: string | null;
  location_label: string | null;
  batch_code: string | null;
  expiration_date: string | null;
  notes: string | null;
  last_entry_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shelf?: { id: string; name: string; code: string | null } | null;
};

export type InventoryMovementRecord = {
  id: string;
  tenant_id: string;
  item_id: string;
  shelf_id: string;
  kind: "initial" | "in" | "out";
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
  item?: { id: string; name: string; unit: string; brand: string | null } | null;
  shelf?: { id: string; name: string; code: string | null } | null;
};

type InventoryItemRow = Omit<InventoryItemRecord, "shelf"> & {
  shelf?: { id: string; name: string; code: string | null }[] | { id: string; name: string; code: string | null } | null;
};

type InventoryMovementRow = Omit<InventoryMovementRecord, "item" | "shelf"> & {
  item?: { id: string; name: string; unit: string; brand: string | null }[] | { id: string; name: string; unit: string; brand: string | null } | null;
  shelf?: { id: string; name: string; code: string | null }[] | { id: string; name: string; code: string | null } | null;
};

function firstRelation<T>(value: T[] | T | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function listInventoryShelvesByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("inventory_shelves")
    .select("id, tenant_id, name, code, note, sort_order, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []) as InventoryShelfRecord[];
}

export async function listInventoryItemsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("id, tenant_id, shelf_id, name, brand, barcode, sku, category, supplier, unit, quantity, min_quantity, cost_price, sale_price, package_size, location_label, batch_code, expiration_date, notes, last_entry_at, is_active, created_at, updated_at, shelf:inventory_shelves(id, name, code)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return ((data ?? []) as InventoryItemRow[]).map((item) => ({
    ...item,
    shelf: firstRelation(item.shelf),
  })) as InventoryItemRecord[];
}

export async function listRecentInventoryMovementsByTenant(tenantId: string, limit = 20) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("inventory_movements")
    .select("id, tenant_id, item_id, shelf_id, kind, quantity, unit_cost, note, source, created_by, created_at, item:inventory_items(id, name, unit, brand), shelf:inventory_shelves(id, name, code)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as InventoryMovementRow[]).map((movement) => ({
    ...movement,
    item: firstRelation(movement.item),
    shelf: firstRelation(movement.shelf),
  })) as InventoryMovementRecord[];
}

export async function findInventoryItemByBarcode(tenantId: string, barcode: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("id, tenant_id, shelf_id, name, brand, barcode, sku, category, supplier, unit, quantity, min_quantity, cost_price, sale_price, package_size, location_label, batch_code, expiration_date, notes, last_entry_at, is_active, created_at, updated_at, shelf:inventory_shelves(id, name, code)")
    .eq("tenant_id", tenantId)
    .eq("barcode", barcode)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  const item = data as InventoryItemRow;
  return {
    ...item,
    shelf: firstRelation(item.shelf),
  } as InventoryItemRecord;
}

export async function createInventoryShelf(input: {
  tenantId: string;
  name: string;
  code: string | null;
  note: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: latestShelf } = await supabase
    .from("inventory_shelves")
    .select("sort_order")
    .eq("tenant_id", input.tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("inventory_shelves").insert({
    tenant_id: input.tenantId,
    name: input.name,
    code: input.code,
    note: input.note,
    sort_order: Number(latestShelf?.sort_order ?? 0) + 1,
    is_active: true,
  });

  return error as { message: string } | null;
}

export async function createInventoryItem(input: {
  tenantId: string;
  shelfId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  supplier: string | null;
  unit: string;
  minQuantity: number;
  costPrice: number;
  salePrice: number;
  packageSize: string | null;
  locationLabel: string | null;
  batchCode: string | null;
  expirationDate: string | null;
  notes: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: input.tenantId,
      shelf_id: input.shelfId,
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      sku: input.sku,
      category: input.category,
      supplier: input.supplier,
      unit: input.unit,
      quantity: 0,
      min_quantity: input.minQuantity,
      cost_price: input.costPrice,
      sale_price: input.salePrice,
      package_size: input.packageSize,
      location_label: input.locationLabel,
      batch_code: input.batchCode,
      expiration_date: input.expirationDate,
      notes: input.notes,
      is_active: true,
    })
    .select("id")
    .single();

  return {
    id: data?.id ?? null,
    error: error as { message: string } | null,
  };
}

export async function updateInventoryItem(input: {
  tenantId: string;
  itemId: string;
  shelfId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  supplier: string | null;
  unit: string;
  minQuantity: number;
  costPrice: number;
  salePrice: number;
  packageSize: string | null;
  locationLabel: string | null;
  batchCode: string | null;
  expirationDate: string | null;
  notes: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      shelf_id: input.shelfId,
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      sku: input.sku,
      category: input.category,
      supplier: input.supplier,
      unit: input.unit,
      min_quantity: input.minQuantity,
      cost_price: input.costPrice,
      sale_price: input.salePrice,
      package_size: input.packageSize,
      location_label: input.locationLabel,
      batch_code: input.batchCode,
      expiration_date: input.expirationDate,
      notes: input.notes,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.itemId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) return error as { message: string };
  return data ? null : { message: "Item de estoque não encontrado." };
}

export async function registerInventoryMovement(input: {
  tenantId: string;
  itemId: string;
  kind: "initial" | "in" | "out";
  quantity: number;
  note: string | null;
  unitCost: number | null;
  source?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("inventory_register_movement", {
    p_tenant_id: input.tenantId,
    p_item_id: input.itemId,
    p_kind: input.kind,
    p_quantity: input.quantity,
    p_note: input.note,
    p_unit_cost: input.unitCost,
    p_source: input.source ?? "manual",
  });

  return {
    quantity: typeof data === "number" ? data : null,
    error: error as { message: string } | null,
  };
}
