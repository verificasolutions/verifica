import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { findInventoryItemByBarcode, registerInventoryMovement } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { parseDecimalValue } from "@/backend/shared/parse-decimal";

export async function quickInventoryEntryUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const shelfId = String(formData.get("shelf_id") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const quantity = parseDecimalValue(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim() || "Entrada rápida";

  if (!shelfId || !barcode || quantity <= 0) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Informe estante, código e quantidade."));
  }

  const item = await findInventoryItemByBarcode(context.tenantId, barcode);

  if (!item) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Código não encontrado. Cadastre o item antes da entrada rápida."));
  }

  const movement = await registerInventoryMovement({
    tenantId: context.tenantId,
    itemId: item.id,
    kind: "in",
    quantity,
    note,
    unitCost: null,
    source: "manual",
  });

  if (movement.error) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", movement.error.message));
  }
}
