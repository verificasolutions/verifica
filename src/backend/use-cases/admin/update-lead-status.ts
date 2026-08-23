import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { saveLeadCompanyActivityAdmin, updateLeadCompanyStatusAdmin } from "@/backend/repos/lead-hunter-repo";
import type { LeadCompanyRecord } from "@/backend/types";

const allowedStatuses: LeadCompanyRecord["status"][] = [
  "found",
  "analyzed",
  "message_generated",
  "contacted",
  "responded",
  "demo_scheduled",
  "closed_won",
  "lost",
  "kept",
  "archived",
];

export async function updateLeadStatusUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as LeadCompanyRecord["status"];

  if (!leadCompanyId) throw new Error("Lead inválido.");
  if (!allowedStatuses.includes(status)) throw new Error("Status comercial inválido.");

  const error = await updateLeadCompanyStatusAdmin(leadCompanyId, status);
  if (error) {
    throw new Error(error.message || "Não foi possível atualizar o lead.");
  }

  await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "status_changed",
    channel: null,
    note: `Status alterado para ${status}.`,
    createdByEmail: admin.email,
  });
}
