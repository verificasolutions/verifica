import "server-only";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { createInventoryShelf } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { assertOperatorInventoryEnabled } from "@/backend/use-cases/operator/inventory-access";

export async function createOperatorInventoryShelfUseCase(formData: FormData) {
  const context = await requireOperator();
  await assertOperatorInventoryEnabled(context.tenantId);

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!name) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", "Nome da prateleira é obrigatório."));
  }

  const error = await createInventoryShelf({
    tenantId: context.tenantId,
    name,
    code,
    note,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, "/operador/dashboard", "error", error.message));
  }
}
