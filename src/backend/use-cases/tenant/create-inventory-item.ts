import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createInventoryItem, registerInventoryMovement } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { parseDecimalValue } from "@/backend/shared/parse-decimal";

export async function createInventoryItemUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const shelfId = String(formData.get("shelf_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim() || null;

  if (!shelfId || !name) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Preencha a estante e o nome do item."));
  }

  const created = await createInventoryItem({
    tenantId: context.tenantId,
    shelfId,
    name,
    brand: String(formData.get("brand") ?? "").trim() || null,
    barcode,
    sku: String(formData.get("sku") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "").trim() || "un",
    minQuantity: parseDecimalValue(formData.get("min_quantity")),
    costPrice: parseDecimalValue(formData.get("cost_price")),
    salePrice: parseDecimalValue(formData.get("sale_price")),
    packageSize: String(formData.get("package_size") ?? "").trim() || null,
    locationLabel: String(formData.get("location_label") ?? "").trim() || null,
    batchCode: String(formData.get("batch_code") ?? "").trim() || null,
    expirationDate: String(formData.get("expiration_date") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (created.error || !created.id) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", created.error?.message ?? "Falha ao criar item de estoque."));
  }

  const initialQuantity = parseDecimalValue(formData.get("initial_quantity"));
  const costPrice = parseDecimalValue(formData.get("cost_price"));

  if (initialQuantity > 0) {
    const movement = await registerInventoryMovement({
      tenantId: context.tenantId,
      itemId: created.id,
      kind: "initial",
      quantity: initialQuantity,
      note: String(formData.get("movement_note") ?? "").trim() || "Cadastro inicial",
      unitCost: costPrice > 0 ? costPrice : null,
      source: "manual",
    });

    if (movement.error) {
      redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", movement.error.message));
    }
  }
}
