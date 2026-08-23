import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createInventoryShelf } from "@/backend/repos/inventory-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";

export async function createInventoryShelfUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!name) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", "Nome da estante é obrigatório."));
  }

  const error = await createInventoryShelf({
    tenantId: context.tenantId,
    name,
    code,
    note,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=estoque", "error", error.message));
  }
}
