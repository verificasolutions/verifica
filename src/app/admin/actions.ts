"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import { createTenantByAdminUseCase } from "@/backend/use-cases/admin/create-tenant";
import { deleteTenantEmployeeByAdminUseCase } from "@/backend/use-cases/admin/delete-tenant-employee";
import { activateCommercialIntakeUseCase } from "@/backend/use-cases/admin/activate-commercial-intake";
import { confirmCommercialPaymentUseCase } from "@/backend/use-cases/admin/confirm-commercial-payment";
import { generateLeadEmailUseCase } from "@/backend/use-cases/admin/generate-lead-email";
import { generateLeadAnalysisUseCase } from "@/backend/use-cases/admin/generate-lead-analysis";
import { generateLeadMessageUseCase } from "@/backend/use-cases/admin/generate-lead-message";
import { importLeadBatchUseCase } from "@/backend/use-cases/admin/import-lead-batch";
import { provisionTenantWhatsappUseCase } from "@/backend/use-cases/admin/provision-tenant-whatsapp";
import { registerLeadActivityUseCase } from "@/backend/use-cases/admin/register-lead-activity";
import { runLeadHuntUseCase } from "@/backend/use-cases/admin/run-lead-hunt";
import { saveLeadEmailSequenceUseCase } from "@/backend/use-cases/admin/save-lead-email-sequence";
import { savePlanUseCase } from "@/backend/use-cases/admin/save-plan";
import { savePlatformSettingsUseCase } from "@/backend/use-cases/admin/save-platform-settings";
import { saveSubscriptionUseCase } from "@/backend/use-cases/admin/save-subscription";
import { saveTenantByAdminUseCase } from "@/backend/use-cases/admin/save-tenant";
import { saveTenantEmployeeByAdminUseCase } from "@/backend/use-cases/admin/save-tenant-employee";
import { saveTenantInstagramConfigUseCase } from "@/backend/use-cases/admin/save-tenant-instagram-config";
import { saveTenantLandingConfigUseCase } from "@/backend/use-cases/admin/save-tenant-landing-config";
import { saveTenantOperatorInventoryConfigUseCase } from "@/backend/use-cases/admin/save-tenant-operator-inventory-config";
import { saveTenantWhatsappConfigUseCase } from "@/backend/use-cases/admin/save-tenant-whatsapp-config";
import { sendLeadEmailUseCase } from "@/backend/use-cases/admin/send-lead-email";
import { sendLeadFirstEmailBatchUseCase } from "@/backend/use-cases/admin/send-lead-first-email-batch";
import { setTenantEmployeeStateByAdminUseCase } from "@/backend/use-cases/admin/set-tenant-employee-state";
import { toggleTenantStatusUseCase } from "@/backend/use-cases/admin/toggle-tenant-status";
import { updateLeadStatusUseCase } from "@/backend/use-cases/admin/update-lead-status";
import { updateSupportTicketUseCase } from "@/backend/use-cases/admin/update-support-ticket";

function redirectWithNotice(basePath: string, kind: "message" | "error", value: string) {
  const safeBase = basePath || "/admin?section=radar";
  const url = new URL(safeBase, "https://local.verifica");
  url.searchParams.set(kind, value);
  return `${url.pathname}${url.search}`;
}

export async function createTenantByAdminAction(formData: FormData) {
  const result = await createTenantByAdminUseCase(formData);
  revalidatePath("/admin");
  revalidatePath("/admin");
  redirect(`/admin?message=${encodeURIComponent(`Tenant criado. Login do responsável: ${result.ownerEmail}`)}`);
}

export async function saveTenantByAdminAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantByAdminUseCase(formData);
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/users`);
  redirect(`/admin/tenants/${tenantId}?message=Tenant atualizado com sucesso.`);
}

export async function toggleTenantStatusAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  await toggleTenantStatusUseCase(formData);
  revalidatePath("/admin");
  revalidatePath("/admin");

  if (tenantId) {
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath(`/admin/tenants/${tenantId}/users`);
  }

  redirect(redirectTo || "/admin?message=Status do tenant atualizado.");
}

export async function savePlanAction(formData: FormData) {
  await savePlanUseCase(formData);
  revalidatePath("/admin");
  redirect("/admin?section=comercial&tab=planos&message=Plano salvo.");
}

export async function saveSubscriptionAction(formData: FormData) {
  await saveSubscriptionUseCase(formData);
  revalidatePath("/admin");
  redirect("/admin?section=comercial&tab=assinaturas&message=Assinatura salva.");
}

export async function updateSupportTicketAction(formData: FormData) {
  await updateSupportTicketUseCase(formData);
  revalidatePath("/admin");
  redirect("/admin?section=suporte&message=Ticket atualizado.");
}

export async function savePlatformSettingsAction(formData: FormData) {
  await savePlatformSettingsUseCase(formData);
  revalidatePath("/admin");
  redirect("/admin?message=Configurações salvas.");
}

export async function provisionTenantWhatsappAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await provisionTenantWhatsappUseCase(formData);
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/workspace`);
}

export async function saveTenantWhatsappConfigAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantWhatsappConfigUseCase(formData);
  revalidatePath("/app/dashboard");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/workspace`);
  redirect(`/admin/tenants/${tenantId}/workspace?message=WhatsApp do tenant salvo.`);
}

export async function saveTenantInstagramConfigAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantInstagramConfigUseCase(formData);
  revalidatePath("/app/dashboard");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/workspace`);
  redirect(`/admin/tenants/${tenantId}/workspace?message=Instagram do tenant salvo.`);
}

export async function saveTenantLandingConfigAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantLandingConfigUseCase(formData);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/landing");
  revalidatePath(`/${String(formData.get("tenant_slug") ?? "").trim()}`);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/workspace`);
  redirect(`/admin/tenants/${tenantId}/workspace?message=Landing do tenant salva.`);
}

export async function saveTenantOperatorInventoryConfigAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantOperatorInventoryConfigUseCase(formData);
  revalidatePath("/app/dashboard");
  revalidatePath("/operador/dashboard");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/workspace`);
  redirect(`/admin/tenants/${tenantId}/workspace?message=Estoque do operador salvo.`);
}

export async function adminSignOutAction() {
  await signOutAction();
}

export async function saveTenantEmployeeByAdminAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await saveTenantEmployeeByAdminUseCase(formData);
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/users`);
  redirect(`/admin/tenants/${tenantId}/users?message=Usuário salvo.`);
}

export async function setTenantEmployeeStateByAdminAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await setTenantEmployeeStateByAdminUseCase(formData);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/users`);
  redirect(`/admin/tenants/${tenantId}/users?message=Status do usuário atualizado.`);
}

export async function deleteTenantEmployeeByAdminAction(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  await deleteTenantEmployeeByAdminUseCase(formData);
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath(`/admin/tenants/${tenantId}/users`);
  redirect(`/admin/tenants/${tenantId}/users?message=Usuário excluído.`);
}

export async function runLeadHuntAction(formData: FormData) {
  try {
    await runLeadHuntUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Busca concluída.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao buscar leads.")}`);
  }
}

export async function importLeadBatchAction(formData: FormData) {
  try {
    const result = await importLeadBatchUseCase(formData);
    revalidatePath("/admin");
    redirect(`/admin?section=radar&message=${encodeURIComponent(`Carga importada: ${result.saved} salvos, ${result.duplicates} duplicados.`)}`);
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao importar carga.")}`);
  }
}

export async function generateLeadAnalysisAction(formData: FormData) {
  try {
    await generateLeadAnalysisUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Análise gerada.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao gerar análise.")}`);
  }
}

export async function generateLeadMessageAction(formData: FormData) {
  try {
    await generateLeadMessageUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Mensagem gerada.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao gerar mensagem.")}`);
  }
}

export async function generateLeadEmailAction(formData: FormData) {
  try {
    await generateLeadEmailUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Rascunho de e-mail gerado.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao gerar e-mail.")}`);
  }
}

export async function sendLeadEmailAction(formData: FormData) {
  try {
    await sendLeadEmailUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=E-mail enviado pelo Resend.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao enviar e-mail.")}`);
  }
}

export async function sendLeadFirstEmailBatchAction(formData: FormData) {
  const returnUrl = String(formData.get("return_url") ?? "").trim() || "/admin?section=radar";

  try {
    const result = await sendLeadFirstEmailBatchUseCase(formData);
    revalidatePath("/admin");
    redirect(
      redirectWithNotice(
        returnUrl,
        "message",
        `Disparo concluido: ${result.sent} enviados, ${result.failed} falhas, ${result.skipped} ignorados.`,
      ),
    );
  } catch (error) {
    redirect(
      redirectWithNotice(
        returnUrl,
        "error",
        error instanceof Error ? error.message : "Falha ao disparar o primeiro e-mail em massa.",
      ),
    );
  }
}

export async function saveLeadEmailSequenceAction(formData: FormData) {
  try {
    await saveLeadEmailSequenceUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Cadencia de e-mails salva.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao salvar a cadencia de e-mails.")}`);
  }
}

export async function updateLeadStatusAction(formData: FormData) {
  try {
    await updateLeadStatusUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Status comercial atualizado.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao atualizar status.")}`);
  }
}

export async function registerLeadActivityAction(formData: FormData) {
  try {
    await registerLeadActivityUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=radar&message=Ação comercial registrada.");
  } catch (error) {
    redirect(`/admin?section=radar&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao registrar ação.")}`);
  }
}

export async function confirmCommercialPaymentAction(formData: FormData) {
  try {
    await confirmCommercialPaymentUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=comercial&tab=cadastros&message=Pagamento confirmado e contrato enviado.");
  } catch (error) {
    redirect(`/admin?section=comercial&tab=cadastros&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao confirmar pagamento.")}`);
  }
}

export async function activateCommercialIntakeAction(formData: FormData) {
  try {
    await activateCommercialIntakeUseCase(formData);
    revalidatePath("/admin");
    redirect("/admin?section=comercial&tab=cadastros&message=Cadastro comercial ativado.");
  } catch (error) {
    redirect(`/admin?section=comercial&tab=cadastros&error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao ativar cadastro.")}`);
  }
}
