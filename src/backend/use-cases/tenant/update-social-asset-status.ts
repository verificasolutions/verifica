import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { updateMarketingAssetStatusForTenant } from "@/backend/repos/marketing-assets-repo";

export async function updateSocialAssetStatusUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as "draft" | "approved" | "discarded";

  if (!assetId || !["draft", "approved", "discarded"].includes(status)) {
    redirect("/app/dashboard?section=adm&panel=social&error=Ação inválida para o conteúdo social.");
  }

  const error = await updateMarketingAssetStatusForTenant({
    tenantId: context.tenantId,
    assetId,
    status,
  });

  if (error) {
    redirect(`/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(error.message)}`);
  }
}
