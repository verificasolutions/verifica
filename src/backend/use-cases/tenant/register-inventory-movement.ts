import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { registerInventoryMovement } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { parseDecimalValue } from "@/backend/shared/parse-decimal";

export async function registerInventoryMovementUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const kind = String(formData.get("movement_kind") ?? "").trim() as "in" | "out";
  const quantity = parseDecimalValue(formData.get("quantity"));

  if (!itemId || !["in", "out"].includes(kind) || quantity <= 0) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Movimentação inválida."));
  }

  const movement = await registerInventoryMovement({
    tenantId: context.tenantId,
    itemId,
    kind,
    quantity,
    note: String(formData.get("note") ?? "").trim() || null,
    unitCost: null,
    source: "manual",
  });

  if (movement.error) {
    const message = movement.error.message === "INSUFFICIENT_STOCK" ? "Estoque insuficiente para essa saída." : movement.error.message;
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", message));
  }
}
