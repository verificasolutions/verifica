import "server-only";
import { redirect } from "next/navigation";
import { digitsOnly } from "@/backend/shared/input-normalizers";
import { slugify } from "@/backend/shared/slug";
import {
  attachOwnerMembershipForSetup,
  createTenantForSetup,
  findTenantBySlugForSetup,
} from "@/backend/repos/tenant-setup-repo";
import { upsertProfileAdmin } from "@/backend/repos/users-admin-repo";

export async function completeAnonymousUserSetupUseCase(formData: FormData, userId: string) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const washName = String(formData.get("wash_name") ?? "").trim();
  const customSlug = String(formData.get("custom_slug") ?? "").trim();
  const whatsapp = digitsOnly(String(formData.get("whatsapp") ?? "").trim());

  if (!fullName || !washName) {
    redirect("/setup?error=Preencha nome e lava-rápido.");
  }

  const slug = slugify(customSlug || washName);

  const profileError = await upsertProfileAdmin({
    userId,
    fullName,
    phone: whatsapp || null,
  });

  if (profileError) {
    redirect(`/setup?error=${encodeURIComponent(profileError.message)}`);
  }

  const existingTenant = await findTenantBySlugForSetup(slug);

  if (existingTenant) {
    redirect("/setup?error=Esse link personalizado já está em uso.");
  }

  const tenant = await createTenantForSetup({
    name: washName,
    slug,
    whatsapp: whatsapp || null,
    createdBy: userId,
  });

  if (tenant.error || !tenant.data) {
    redirect(`/setup?error=${encodeURIComponent(tenant.error?.message ?? "Falha ao criar tenant.")}`);
  }

  const membershipError = await attachOwnerMembershipForSetup({
    tenantId: tenant.data.id,
    userId,
  });

  if (membershipError) {
    redirect(`/setup?error=${encodeURIComponent(membershipError.message)}`);
  }
}
