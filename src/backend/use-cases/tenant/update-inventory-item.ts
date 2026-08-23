import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listInventoryShelvesByTenant, updateInventoryItem } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { parseDecimalValue } from "@/backend/shared/parse-decimal";

export async function updateInventoryItemUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const shelfId = String(formData.get("shelf_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!itemId || !shelfId || !name) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Preencha a estante e o nome do item."));
  }

  const shelves = await listInventoryShelvesByTenant(context.tenantId);
  if (!shelves.some((shelf) => shelf.id === shelfId)) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Estante inválida para este tenant."));
  }

  const error = await updateInventoryItem({
    tenantId: context.tenantId,
    itemId,
    shelfId,
    name,
    brand: String(formData.get("brand") ?? "").trim() || null,
    barcode: String(formData.get("barcode") ?? "").trim() || null,
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

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", error.message));
  }
}
