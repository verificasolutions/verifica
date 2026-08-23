import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { getTenantWorkspaceAdmin } from "@/backend/repos/admin-control-repo";

export async function getAdminTenantWorkspaceUseCase(tenantId: string) {
  await requirePlatformAdmin();
  const workspace = await getTenantWorkspaceAdmin(tenantId);

  if (!workspace) {
    redirect("/admin?error=Tenant não encontrado.");
  }

  return workspace;
}
