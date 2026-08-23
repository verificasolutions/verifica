import "server-only";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { findInventoryItemByBarcode, listInventoryShelvesByTenant, registerInventoryMovement } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { parseDecimalValue } from "@/backend/shared/parse-decimal";
import { assertOperatorInventoryEnabled } from "@/backend/use-cases/operator/inventory-access";

export async function quickOperatorInventoryEntryUseCase(formData: FormData) {
  const context = await requireOperator();
  await assertOperatorInventoryEnabled(context.tenantId);

  const shelfId = String(formData.get("shelf_id") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const quantity = parseDecimalValue(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim() || "Entrada rápida";

  if (!shelfId || !barcode || quantity <= 0) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", "Informe prateleira, código e quantidade."));
  }

  const shelves = await listInventoryShelvesByTenant(context.tenantId);
  if (!shelves.some((shelf) => shelf.id === shelfId)) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", "Prateleira inválida para este tenant."));
  }

  const item = await findInventoryItemByBarcode(context.tenantId, barcode);
  if (!item) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", "Código não encontrado. Cadastre o item antes da entrada rápida."));
  }

  const movement = await registerInventoryMovement({
    tenantId: context.tenantId,
    itemId: item.id,
    kind: "in",
    quantity,
    note,
    unitCost: null,
    source: "operator",
  });

  if (movement.error) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", movement.error.message));
  }
}
