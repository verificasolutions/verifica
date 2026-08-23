import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { saveLeadCompanyActivityAdmin } from "@/backend/repos/lead-hunter-repo";

export async function registerLeadActivityUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim();

  if (!leadCompanyId) throw new Error("Lead inválido.");
  if (!note) throw new Error("Descreva a ação realizada.");

  const result = await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "manual_update",
    channel,
    note,
    createdByEmail: admin.email,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível registrar a ação.");
  }
}
