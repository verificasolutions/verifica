import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { upsertTenantCompanyProfileAdmin } from "@/backend/repos/tenant-company-profiles-admin-repo";
import { findTenantBySlugExcludingIdAdmin, getTenantByIdAdmin, updateTenantAdmin } from "@/backend/repos/tenants-admin-repo";
import { digitsOnly, registrationOnly } from "@/backend/shared/input-normalizers";
import { slugify } from "@/backend/shared/slug";
import { normalizeTenantOperationalProfile } from "@/backend/shared/tenant-operational-profile";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveTenantByAdminUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = text(formData, "tenant_id");
  const currentTenant = await getTenantByIdAdmin(tenantId);

  if (!tenantId || !currentTenant) {
    redirect("/admin?section=tenants&error=Tenant não encontrado.");
  }

  const tenantName = text(formData, "tenant_name");
  const slugInput = text(formData, "slug");
  const legalName = text(formData, "legal_name");
  const tradeName = text(formData, "trade_name");
  const cnpj = digitsOnly(text(formData, "cnpj"));
  const stateRegistration = registrationOnly(text(formData, "state_registration"));
  const municipalRegistration = registrationOnly(text(formData, "municipal_registration"));
  const companyEmail = text(formData, "company_email").toLowerCase();
  const companyPhone = digitsOnly(text(formData, "company_phone"));
  const companyPhoneSecondary = digitsOnly(text(formData, "company_phone_secondary"));
  const postalCode = digitsOnly(text(formData, "postal_code"));
  const street = text(formData, "street");
  const streetNumber = text(formData, "street_number");
  const complement = text(formData, "complement");
  const neighborhood = text(formData, "neighborhood");
  const city = text(formData, "city");
  const state = text(formData, "state").toUpperCase();
  const country = text(formData, "country") || "Brasil";
  const ownerName = text(formData, "owner_name");
  const ownerEmail = text(formData, "owner_email").toLowerCase();
  const operationalProfile = normalizeTenantOperationalProfile(formData.get("operational_profile"));
  const representativeRole = text(formData, "representative_role");
  const representativePhone = digitsOnly(text(formData, "representative_phone"));
  const representativePhoneSecondary = digitsOnly(text(formData, "representative_phone_secondary"));

  if (!tenantName || !legalName || !tradeName || !companyEmail || !ownerName || !ownerEmail) {
    redirect(`/admin/tenants/${tenantId}?drawer=edit-tenant&error=Preencha todos os campos obrigatórios do tenant.`);
  }

  const slug = slugify(slugInput || tenantName || tradeName);
  const slugInUse = await findTenantBySlugExcludingIdAdmin(slug, tenantId);

  if (slugInUse) {
    redirect(`/admin/tenants/${tenantId}?drawer=edit-tenant&error=Slug já em uso por outro tenant.`);
  }

  const tenantError = await updateTenantAdmin({
    tenantId,
    name: tradeName || tenantName,
    slug,
    whatsapp: companyPhone || null,
    operationalProfile,
  });

  if (tenantError) {
    redirect(`/admin/tenants/${tenantId}?drawer=edit-tenant&error=${encodeURIComponent(tenantError.message)}`);
  }

  const website = text(formData, "website");

  const companyProfileError = await upsertTenantCompanyProfileAdmin({
    tenant_id: tenantId,
    legal_name: legalName,
    trade_name: tradeName,
    cnpj: cnpj || null,
    state_registration: stateRegistration || null,
    municipal_registration: municipalRegistration || null,
    email: companyEmail || null,
    phone: companyPhone || null,
    phone_secondary: companyPhoneSecondary || null,
    website: website || null,
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
    redirect(`/admin/tenants/${tenantId}?drawer=edit-tenant&error=${encodeURIComponent(companyProfileError.message)}`);
  }

  // cadastro atualizado: a landing pública e a tela interna refletem imediatamente
  revalidatePath(`/verifica/${slug}`);
  revalidatePath(`/${slug}`);
  revalidatePath("/app/landing");

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "tenant.updated",
    entity_type: "tenant",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} atualizou os dados do tenant ${tradeName || tenantName}.`,
    metadata: {
      slug,
      legalName,
      tradeName,
      cnpj,
      companyEmail,
      ownerEmail,
      operationalProfile,
    },
  });
}
