import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getEmployeeById, setEmployeeActiveStateForTenant } from "@/backend/repos/employees-repo";
import { setTenantUserActiveStateAdmin } from "@/backend/repos/tenant-users-admin-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";

export async function setEmployeeStateUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "") === "true";
  const fallbackTarget = `/app/dashboard?section=adm&panel=employees&employeeId=${employeeId}`;

  if (!employeeId) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "error", "Funcionário inválido."));
  }

  const employee = await getEmployeeById(context.tenantId, employeeId);
  if (!employee) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "error", "Funcionário não encontrado."));
  }

  const error = await setEmployeeActiveStateForTenant({
    tenantId: context.tenantId,
    employeeId,
    isActive,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", error.message));
  }

  if (!isActive && employee.auth_user_id) {
    await setTenantUserActiveStateAdmin({
      tenantId: context.tenantId,
      userId: employee.auth_user_id,
      isActive: false,
    });
  }

  redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "message", isActive ? "Funcionário reativado." : "Funcionário inativado."));
}
