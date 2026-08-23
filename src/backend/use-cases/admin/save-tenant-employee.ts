import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { createTenantEmployeeAdmin, getTenantEmployeeByIdAdmin, updateTenantEmployeeAdmin } from "@/backend/repos/employees-admin-repo";
import { setTenantUserActiveStateAdmin, upsertTenantOperatorAdmin } from "@/backend/repos/tenant-users-admin-repo";
import { createAuthUserAdmin, findAuthUserByEmailAdmin, updateAuthUserAdmin, upsertProfileAdmin } from "@/backend/repos/users-admin-repo";
import { digitsOnly, parseCurrencyInput } from "@/backend/shared/input-normalizers";

function cleanText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function usersDrawerUrl(tenantId: string, employeeId?: string) {
  if (!employeeId) return `/admin/tenants/${tenantId}/users?drawer=new-user`;
  return `/admin/tenants/${tenantId}/users?drawer=edit-user&employee_id=${employeeId}`;
}

export async function saveTenantEmployeeByAdminUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = cleanText(formData, "tenant_id");
  const employeeId = cleanText(formData, "employee_id");
  const name = cleanText(formData, "name");
  const email = cleanText(formData, "email").toLowerCase() || null;
  const phone = digitsOnly(cleanText(formData, "phone")) || null;
  const contactPhone = digitsOnly(cleanText(formData, "contact_phone")) || null;
  const cpf = digitsOnly(cleanText(formData, "cpf")) || null;
  const birthDate = cleanText(formData, "birth_date") || null;
  const postalCode = digitsOnly(cleanText(formData, "postal_code")) || null;
  const street = cleanText(formData, "street") || null;
  const streetNumber = cleanText(formData, "street_number") || null;
  const complement = cleanText(formData, "complement") || null;
  const neighborhood = cleanText(formData, "neighborhood") || null;
  const city = cleanText(formData, "city") || null;
  const state = cleanText(formData, "state").toUpperCase() || null;
  const internalCode = cleanText(formData, "internal_code") || null;
  const roleLabel = cleanText(formData, "role_label");
  const paymentType = cleanText(formData, "payment_type") as "daily" | "commission" | "fixed";
  const paymentValue = parseCurrencyInput(formData.get("payment_value"));
  const canAccessSystem = String(formData.get("can_access_system") ?? "") === "true";
  const password = cleanText(formData, "password");

  if (!tenantId || !name || !roleLabel || !Number.isFinite(paymentValue)) {
    redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=Preencha corretamente os dados do usuário.`);
  }

  let authUserId: string | null = null;
  const existingEmployee = employeeId ? await getTenantEmployeeByIdAdmin(tenantId, employeeId) : null;

  if (employeeId && !existingEmployee) {
    redirect(`/admin/tenants/${tenantId}/users?error=Usuário do tenant não encontrado.`);
  }

  if (canAccessSystem) {
    if (!email) {
      redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=E-mail é obrigatório para acesso ao sistema.`);
    }

    if (existingEmployee?.auth_user_id) {
      const updated = await updateAuthUserAdmin({
        userId: existingEmployee.auth_user_id,
        email,
        password: password || undefined,
        fullName: name,
      });

      if (updated.error) {
        redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=${encodeURIComponent(updated.error.message)}`);
      }

      authUserId = existingEmployee.auth_user_id;
    } else {
      const existingUser = await findAuthUserByEmailAdmin(email);
      if (!existingUser) {
        if (!password) {
          redirect(`/admin/tenants/${tenantId}/users?drawer=new-user&error=Senha inicial é obrigatória para novo acesso.`);
        }

        const created = await createAuthUserAdmin({
          email,
          password,
          fullName: name,
        });

        if (created.error || !created.data.user) {
          redirect(`/admin/tenants/${tenantId}/users?drawer=new-user&error=${encodeURIComponent(created.error?.message ?? "Falha ao criar acesso do usuário.")}`);
        }

        authUserId = created.data.user.id;
      } else {
        const updated = await updateAuthUserAdmin({
          userId: existingUser.id,
          email,
          password: password || undefined,
          fullName: name,
        });

        if (updated.error) {
          redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=${encodeURIComponent(updated.error.message)}`);
        }

        authUserId = existingUser.id;
      }
    }

    const profileError = await upsertProfileAdmin({
      userId: authUserId,
      fullName: name,
      phone: phone,
    });

    if (profileError) {
      redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=${encodeURIComponent(profileError.message)}`);
    }

    const membershipError = await upsertTenantOperatorAdmin({
      tenantId,
      userId: authUserId,
    });

    if (membershipError) {
      redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=${encodeURIComponent(membershipError.message)}`);
    }
  } else if (existingEmployee?.auth_user_id) {
    authUserId = existingEmployee.auth_user_id;
    await setTenantUserActiveStateAdmin({
      tenantId,
      userId: existingEmployee.auth_user_id,
      isActive: false,
    });
  }

  const payload = {
    tenantId,
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
    authUserId: canAccessSystem ? authUserId : null,
  };

  const error = existingEmployee
    ? await updateTenantEmployeeAdmin({ ...payload, employeeId })
    : await createTenantEmployeeAdmin(payload);

  if (error) {
    redirect(`${usersDrawerUrl(tenantId, employeeId || undefined)}&error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: existingEmployee ? "tenant.employee.updated" : "tenant.employee.created",
    entity_type: "employee",
    entity_id: existingEmployee?.id ?? authUserId,
    message: `${admin.email ?? "admin"} ${existingEmployee ? "atualizou" : "criou"} o usuário ${name}.`,
    metadata: {
      email,
      canAccessSystem,
      roleLabel,
      internalCode,
    },
  });
}
