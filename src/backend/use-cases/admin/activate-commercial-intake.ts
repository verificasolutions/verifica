import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { updateCommercialIntakeStatusAdmin } from "@/backend/repos/commercial-intakes-repo";

export async function activateCommercialIntakeUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const intakeId = String(formData.get("commercial_intake_id") ?? "").trim();
  const notes = String(formData.get("internal_notes") ?? "").trim() || null;

  if (!intakeId) {
    throw new Error("Cadastro comercial inválido.");
  }

  const updated = await updateCommercialIntakeStatusAdmin({
    id: intakeId,
    status: "active",
    internal_notes: notes,
  });

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: "platform_admin",
    action: "commercial_intake.activated",
    entity_type: "commercial_intake",
    entity_id: updated.id,
    message: `${admin.email ?? "admin"} ativou o cadastro comercial ${updated.email}.`,
    metadata: {
      selected_plan_code: updated.selected_plan_code,
    },
  });
}
