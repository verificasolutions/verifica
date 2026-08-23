import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { sendCommercialContractEmail } from "@/backend/integrations/commercial-contract-email";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { findCommercialIntakeById, updateCommercialIntakeStatusAdmin } from "@/backend/repos/commercial-intakes-repo";

export async function confirmCommercialPaymentUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const intakeId = String(formData.get("commercial_intake_id") ?? "").trim();
  const notes = String(formData.get("internal_notes") ?? "").trim() || null;

  if (!intakeId) {
    throw new Error("Cadastro comercial inválido.");
  }

  const intake = await findCommercialIntakeById(intakeId);
  if (!intake) {
    throw new Error("Cadastro comercial não encontrado.");
  }

  let emailSentAt: string | null = null;
  let emailError: string | null = null;

  try {
    await sendCommercialContractEmail({ intake });
    emailSentAt = new Date().toISOString();
  } catch (error) {
    emailError = error instanceof Error ? error.message : "Falha ao enviar contrato.";
  }

  const updated = await updateCommercialIntakeStatusAdmin({
    id: intakeId,
    status: "paid",
    payment_status: "paid",
    payment_confirmed_at: new Date().toISOString(),
    contract_email_sent_at: emailSentAt,
    contract_email_error: emailError,
    internal_notes: notes,
  });

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: "platform_admin",
    action: "commercial_intake.payment_confirmed",
    entity_type: "commercial_intake",
    entity_id: updated.id,
    message: `${admin.email ?? "admin"} confirmou pagamento do cadastro comercial ${updated.email}.`,
    metadata: {
      contract_email_sent_at: emailSentAt,
      contract_email_error: emailError,
      selected_plan_code: updated.selected_plan_code,
    },
  });

  if (emailError) {
    throw new Error(`Pagamento confirmado, mas o envio do contrato falhou: ${emailError}`);
  }
}
