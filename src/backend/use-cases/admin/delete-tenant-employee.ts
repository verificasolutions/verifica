import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { deleteTenantEmployeeAdmin, getTenantEmployeeByIdAdmin } from "@/backend/repos/employees-admin-repo";
import { deleteTenantUserMembershipAdmin } from "@/backend/repos/tenant-users-admin-repo";

export async function deleteTenantEmployeeByAdminUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();

  const employee = await getTenantEmployeeByIdAdmin(tenantId, employeeId);
  if (!employee) {
    redirect(`/admin/tenants/${tenantId}/users?error=Usuário do tenant não encontrado.`);
  }

  const error = await deleteTenantEmployeeAdmin(tenantId, employeeId);
  if (error) {
    redirect(`/admin/tenants/${tenantId}/users?drawer=edit-user&employee_id=${employeeId}&error=${encodeURIComponent(error.message)}`);
  }

  if (employee.auth_user_id) {
    await deleteTenantUserMembershipAdmin({
      tenantId,
      userId: employee.auth_user_id,
    });
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "tenant.employee.deleted",
    entity_type: "employee",
    entity_id: employeeId,
    message: `${admin.email ?? "admin"} excluiu o usuário ${employee.name}.`,
  });
}
