import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, findPlanByCodeAdmin, getPlatformSettingsAdmin, upsertSubscriptionAdmin, upsertTenantWhatsappConfigAdmin } from "@/backend/repos/admin-control-repo";
import { upsertTenantCompanyProfileAdmin } from "@/backend/repos/tenant-company-profiles-admin-repo";
import { seedDefaultOperationBoxesAdmin } from "@/backend/repos/operation-boxes-admin-repo";
import { upsertTenantOwnerAdmin } from "@/backend/repos/tenant-users-admin-repo";
import { findTenantBySlugAdmin, createTenantAdmin } from "@/backend/repos/tenants-admin-repo";
import {
  createAuthUserAdmin,
  findAuthUserByEmailAdmin,
  updateAuthUserAdmin,
  upsertProfileAdmin,
} from "@/backend/repos/users-admin-repo";
import { digitsOnly, registrationOnly } from "@/backend/shared/input-normalizers";
import { slugify } from "@/backend/shared/slug";
import { buildTenantEvolutionInstance, buildTenantEvolutionToken } from "@/backend/shared/tenant-whatsapp";
import { normalizeTenantOperationalProfile } from "@/backend/shared/tenant-operational-profile";

export async function createTenantByAdminUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();

  const tenantName = String(formData.get("tenant_name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const legalName = String(formData.get("legal_name") ?? "").trim();
  const tradeName = String(formData.get("trade_name") ?? "").trim();
  const cnpj = digitsOnly(String(formData.get("cnpj") ?? "").trim());
  const stateRegistration = registrationOnly(String(formData.get("state_registration") ?? "").trim());
  const municipalRegistration = registrationOnly(String(formData.get("municipal_registration") ?? "").trim());
  const companyEmail = String(formData.get("company_email") ?? "").trim().toLowerCase();
  const companyPhone = digitsOnly(String(formData.get("company_phone") ?? "").trim());
  const companyPhoneSecondary = digitsOnly(String(formData.get("company_phone_secondary") ?? "").trim());
  const postalCode = digitsOnly(String(formData.get("postal_code") ?? "").trim());
  const street = String(formData.get("street") ?? "").trim();
  const streetNumber = String(formData.get("street_number") ?? "").trim();
  const complement = String(formData.get("complement") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const country = String(formData.get("country") ?? "Brasil").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();
  const ownerPassword = String(formData.get("owner_password") ?? "").trim();
  const operationalProfile = normalizeTenantOperationalProfile(formData.get("operational_profile"));
  const representativeRole = String(formData.get("representative_role") ?? "").trim();
  const representativePhone = digitsOnly(String(formData.get("representative_phone") ?? "").trim());
  const representativePhoneSecondary = digitsOnly(String(formData.get("representative_phone_secondary") ?? "").trim());

  if (!tenantName || !legalName || !tradeName || !companyEmail || !ownerName || !ownerEmail || !ownerPassword) {
    redirect("/admin?section=tenants&drawer=new-tenant&error=Preencha os campos obrigatórios do tenant.");
  }

  const slug = slugify(slugInput || tenantName || tradeName);
  const existingTenant = await findTenantBySlugAdmin(slug);

  if (existingTenant) {
    redirect("/admin?section=tenants&drawer=new-tenant&error=Slug já em uso.");
  }

  const existingOwner = await findAuthUserByEmailAdmin(ownerEmail);
  let ownerId = existingOwner?.id;

  if (!ownerId) {
    const createdUser = await createAuthUserAdmin({
      email: ownerEmail,
      password: ownerPassword,
      fullName: ownerName,
    });

    if (createdUser.error || !createdUser.data.user) {
      redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(createdUser.error?.message ?? "Falha ao criar responsável.")}`);
    }

    ownerId = createdUser.data.user.id;
  } else {
    const updatedUser = await updateAuthUserAdmin({
      userId: ownerId,
      password: ownerPassword,
      fullName: ownerName,
    });

    if (updatedUser.error) {
      redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(updatedUser.error.message)}`);
    }
  }

  const profileError = await upsertProfileAdmin({
    userId: ownerId,
    fullName: ownerName,
    phone: representativePhone || companyPhone || null,
  });

  if (profileError) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(profileError.message)}`);
  }

  const createdTenant = await createTenantAdmin({
    name: tradeName || tenantName,
    slug,
    whatsapp: companyPhone || null,
    operationalProfile,
    createdBy: ownerId,
  });

  if (createdTenant.error || !createdTenant.data) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(createdTenant.error?.message ?? "Falha ao criar tenant.")}`);
  }

  const membershipError = await upsertTenantOwnerAdmin({
    tenantId: createdTenant.data.id,
    userId: ownerId,
  });

  if (membershipError) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(membershipError.message)}`);
  }

  const companyProfileError = await upsertTenantCompanyProfileAdmin({
    tenant_id: createdTenant.data.id,
    legal_name: legalName,
    trade_name: tradeName,
    cnpj: cnpj || null,
    state_registration: stateRegistration || null,
    municipal_registration: municipalRegistration || null,
    email: companyEmail || null,
    phone: companyPhone || null,
    phone_secondary: companyPhoneSecondary || null,
    postal_code: postalCode || null,
    street: street || null,
    street_number: streetNumber || null,
    complement: complement || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    country: country || null,
    representative_name: ownerName,
    representative_role: representativeRole || null,
    representative_email: ownerEmail,
    representative_phone: representativePhone || null,
    representative_phone_secondary: representativePhoneSecondary || null,
  });

  if (companyProfileError) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(companyProfileError.message)}`);
  }

  const defaultPlan = await findPlanByCodeAdmin("pro");
  await upsertSubscriptionAdmin({
    tenant_id: createdTenant.data.id,
    plan_id: defaultPlan?.id ?? null,
    status: "trialing",
    amount: defaultPlan?.price_monthly ?? 0,
    current_period_end: null,
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const platformSettings = await getPlatformSettingsAdmin();
  const evolutionInstance = buildTenantEvolutionInstance({
    tenantId: createdTenant.data.id,
    tenantSlug: slug,
    tenantName: tradeName || tenantName,
  });
  const evolutionToken = buildTenantEvolutionToken();

  const tenantWhatsappError = await upsertTenantWhatsappConfigAdmin({
    tenantId: createdTenant.data.id,
    evolutionBaseUrl: platformSettings?.whatsapp_base_url ?? null,
    evolutionInstance,
    evolutionApiKey: evolutionToken,
    evolutionEnabled: Boolean(platformSettings?.whatsapp_base_url && platformSettings?.evolution_api_key && platformSettings?.evolution_enabled),
    customerMessagesEnabled: false,
  });

  if (tenantWhatsappError) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(tenantWhatsappError.message)}`);
  }

  const operationBoxesError = await seedDefaultOperationBoxesAdmin(createdTenant.data.id, operationalProfile);

  if (operationBoxesError) {
    redirect(`/admin?section=tenants&drawer=new-tenant&error=${encodeURIComponent(operationBoxesError.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: createdTenant.data.id,
    action: "tenant.created",
    entity_type: "tenant",
    entity_id: createdTenant.data.id,
    message: `${admin.email ?? "admin"} criou o tenant ${tradeName || tenantName}.`,
    metadata: {
      slug,
      legalName,
      tradeName,
      cnpj,
      ownerEmail,
      companyEmail,
      evolutionInstance,
      operationalProfile,
    },
  });

  return {
    tenantId: createdTenant.data.id,
    tenantName: tradeName || tenantName,
    ownerEmail,
  };
}
