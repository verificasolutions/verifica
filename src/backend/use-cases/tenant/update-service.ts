import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listActiveServicesByTenant, updateServiceForTenant } from "@/backend/repos/services-repo";
import { buildServicePayloadFromForm } from "@/backend/use-cases/tenant/service-form";

export async function updateServiceUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const serviceId = String(formData.get("service_id") ?? "").trim();

  if (!serviceId) {
    redirect("/app/dashboard?error=Serviço inválido para edição.");
  }

  const services = await listActiveServicesByTenant(context.tenantId);
  const payload = buildServicePayloadFromForm(formData, services, context.tenant.operational_profile);

  const error = await updateServiceForTenant({
    tenantId: context.tenantId,
    serviceId,
    ...payload,
  });

  if (error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
