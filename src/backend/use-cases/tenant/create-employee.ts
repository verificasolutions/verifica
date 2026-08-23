import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createEmployeeForTenant } from "@/backend/repos/employees-repo";
import { getEmployeeByAuthUserAdmin } from "@/backend/repos/employees-admin-repo";
import { upsertTenantOperatorAdmin } from "@/backend/repos/tenant-users-admin-repo";
import { createAuthUserAdmin, findAuthUserByEmailAdmin, updateAuthUserAdmin, upsertProfileAdmin } from "@/backend/repos/users-admin-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { digitsOnly, parseCurrencyInput } from "@/backend/shared/input-normalizers";

export async function createEmployeeUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const name = String(formData.get("name") ?? "").trim();
  const phone = digitsOnly(String(formData.get("phone") ?? "").trim());
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
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
  const requestedSystemAccess = String(formData.get("can_access_system") ?? "") === "true";
  const password = String(formData.get("password") ?? "").trim();
  const fallbackTarget = "/app/dashboard?section=adm&panel=employees&employeeId=new";

  if (!name || !roleLabel || !Number.isFinite(paymentValue)) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Dados inválidos para funcionário."));
  }

  let authUserId: string | null = null;
  let canAccessSystem = false;
  let postSaveMessage = "Funcionário criado.";

  if (requestedSystemAccess) {
    if (!email || !password) {
      postSaveMessage = "Funcionário criado sem acesso ao sistema. Preencha e-mail e senha para liberar acesso.";
    } else {
      const existingUser = await findAuthUserByEmailAdmin(email);

      if (!existingUser) {
        const created = await createAuthUserAdmin({
          email,
          password,
          fullName: name,
        });

        if (created.error || !created.data.user) {
          postSaveMessage = "Funcionário criado sem acesso ao sistema. Não foi possível criar a conta agora.";
        } else {
          authUserId = created.data.user.id;
        }
      } else {
        const linkedEmployee = await getEmployeeByAuthUserAdmin(existingUser.id);
        if (linkedEmployee) {
          postSaveMessage = "Funcionário criado sem acesso ao sistema. Esse e-mail já está vinculado a outro funcionário.";
        } else {
          const updated = await updateAuthUserAdmin({
            userId: existingUser.id,
            password,
            fullName: name,
          });

          if (updated.error) {
            postSaveMessage = "Funcionário criado sem acesso ao sistema. Não foi possível vincular a conta agora.";
          } else {
            authUserId = existingUser.id;
          }
        }
      }

      if (authUserId) {
        const profileError = await upsertProfileAdmin({
          userId: authUserId,
          fullName: name,
          phone: phone || null,
        });

        if (profileError) {
          authUserId = null;
          postSaveMessage = "Funcionário criado sem acesso ao sistema. Não foi possível atualizar o perfil da conta.";
        } else {
          const membershipError = await upsertTenantOperatorAdmin({
            tenantId: context.tenantId,
            userId: authUserId,
          });

          if (membershipError) {
            authUserId = null;
            postSaveMessage = "Funcionário criado sem acesso ao sistema. Não foi possível vincular a conta ao tenant.";
          } else {
            canAccessSystem = true;
          }
        }
      }
    }
  }

  const error = await createEmployeeForTenant({
    tenantId: context.tenantId,
    name,
    phone: phone || null,
    email: email || null,
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

  if (postSaveMessage !== "Funcionário criado.") {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "message", postSaveMessage));
  }
}
