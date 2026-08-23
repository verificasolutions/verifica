import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createServiceForTenant, listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { buildServicePayloadFromForm } from "@/backend/use-cases/tenant/service-form";

export async function createServiceUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const services = await listActiveServicesByTenant(context.tenantId);
  const payload = buildServicePayloadFromForm(formData, services, context.tenant.operational_profile);

  const error = await createServiceForTenant({
    tenantId: context.tenantId,
    ...payload,
  });

  if (error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
