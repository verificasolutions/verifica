import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getEmployeeById, updateEmployeeForTenant } from "@/backend/repos/employees-repo";
import { getEmployeeByAuthUserAdmin } from "@/backend/repos/employees-admin-repo";
import { setTenantUserActiveStateAdmin, upsertTenantOperatorAdmin } from "@/backend/repos/tenant-users-admin-repo";
import { createAuthUserAdmin, findAuthUserByEmailAdmin, updateAuthUserAdmin, upsertProfileAdmin } from "@/backend/repos/users-admin-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { digitsOnly, parseCurrencyInput } from "@/backend/shared/input-normalizers";

export async function saveEmployeeUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = digitsOnly(String(formData.get("phone") ?? "").trim()) || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const contactPhone = digitsOnly(String(formData.get("contact_phone") ?? "").trim()) || null;
  const cpf = digitsOnly(String(formData.get("cpf") ?? "").trim()) || null;
  const birthDate = String(formData.get("birth_date") ?? "").trim() || null;
  const postalCode = digitsOnly(String(formData.get("postal_code") ?? "").trim()) || null;
  const street = String(formData.get("street") ?? "").trim() || null;
  const streetNumber = String(formData.get("street_number") ?? "").trim() || null;
  const complement = String(formData.get("complement") ?? "").trim() || null;
  const neighborhood = String(formData.get("neighborhood") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim().toUpperCase() || null;
  const internalCode = String(formData.get("internal_code") ?? "").trim() || null;
  const roleLabel = String(formData.get("role_label") ?? "").trim();
  const paymentType = String(formData.get("payment_type") ?? "daily").trim() as "daily" | "commission" | "fixed";
  const paymentValue = parseCurrencyInput(formData.get("payment_value"));
  const wantsAccess = String(formData.get("can_access_system") ?? "") === "true";
  const password = String(formData.get("password") ?? "").trim();
  const fallbackTarget = `/app/dashboard?section=adm&panel=employees&employeeId=${employeeId}`;

  if (!employeeId || !name || !roleLabel || !Number.isFinite(paymentValue)) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Dados inválidos para funcionário."));
  }

  const employee = await getEmployeeById(context.tenantId, employeeId);
  if (!employee) {
    redirect(buildDashboardRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "error", "Funcionário não encontrado."));
  }

  let authUserId = employee.auth_user_id;
  let canAccessSystem = false;
  let message = "Funcionário atualizado.";

  if (wantsAccess) {
    if (!email) {
      redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "E-mail é obrigatório para liberar acesso."));
    }

    if (authUserId) {
      const updated = await updateAuthUserAdmin({
        userId: authUserId,
        email,
        password: password || undefined,
        fullName: name,
      });

      if (updated.error) {
        redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", updated.error.message));
      }
    } else {
      const existingUser = await findAuthUserByEmailAdmin(email);

      if (!existingUser) {
        if (!password) {
          redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Senha é obrigatória para novo acesso."));
        }

        const created = await createAuthUserAdmin({
          email,
          password,
          fullName: name,
        });

        if (created.error || !created.data.user) {
          redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", created.error?.message ?? "Falha ao criar acesso do funcionário."));
        }

        authUserId = created.data.user.id;
      } else {
        const linkedEmployee = await getEmployeeByAuthUserAdmin(existingUser.id);
        if (linkedEmployee && linkedEmployee.id !== employee.id) {
          redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Esse e-mail já está vinculado a outro funcionário."));
        }

        const updated = await updateAuthUserAdmin({
          userId: existingUser.id,
          email,
          password: password || undefined,
          fullName: name,
        });

        if (updated.error) {
          redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", updated.error.message));
        }

        authUserId = existingUser.id;
      }
    }

    if (!authUserId) {
      redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Falha ao vincular acesso ao funcionário."));
    }

    const profileError = await upsertProfileAdmin({
      userId: authUserId,
      fullName: name,
      phone,
    });

    if (profileError) {
      redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", profileError.message));
    }

    const membershipError = await upsertTenantOperatorAdmin({
      tenantId: context.tenantId,
      userId: authUserId,
    });

    if (membershipError) {
      redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", membershipError.message));
    }

    canAccessSystem = true;
  } else if (authUserId) {
    await setTenantUserActiveStateAdmin({
      tenantId: context.tenantId,
      userId: authUserId,
      isActive: false,
    });
    authUserId = null;
  }

  const error = await updateEmployeeForTenant({
    tenantId: context.tenantId,
    employeeId,
    name,
    phone,
    email,
    contactPhone,
    cpf,
    birthDate,
    postalCode,
    street,
    streetNumber,
    complement,
    neighborhood,
    city,
    state,
    internalCode,
    roleLabel,
    canAccessSystem,
    paymentType,
    paymentValue,
    authUserId,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", error.message));
  }

  redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "message", message));
}
