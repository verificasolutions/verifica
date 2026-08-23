import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { getTenantPreviewAdmin } from "@/backend/repos/admin-control-repo";
import { listTenantEmployeesAdmin } from "@/backend/repos/employees-admin-repo";

export async function getAdminTenantPreviewUseCase(tenantId: string) {
  await requirePlatformAdmin();
  const [preview, employees] = await Promise.all([getTenantPreviewAdmin(tenantId), listTenantEmployeesAdmin(tenantId)]);

  if (!preview) {
    redirect("/admin?error=Tenant não encontrado.");
  }

  return {
    ...preview,
    employees,
  };
}
