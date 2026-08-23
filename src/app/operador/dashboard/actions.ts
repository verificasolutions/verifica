"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { claimAttendanceUseCase } from "@/backend/use-cases/operator/claim-attendance";
import { createOperatorInventoryItemUseCase } from "@/backend/use-cases/operator/create-inventory-item";
import { createOperatorInventoryShelfUseCase } from "@/backend/use-cases/operator/create-inventory-shelf";
import { moveAttendanceToBoxUseCase } from "@/backend/use-cases/operator/move-attendance-to-box";
import { quickOperatorInventoryEntryUseCase } from "@/backend/use-cases/operator/quick-inventory-entry";
import { registerOperatorInventoryMovementUseCase } from "@/backend/use-cases/operator/register-inventory-movement";
import { ensureReadyPhotoIfRequired, uploadAttendanceMediaUseCase } from "@/backend/use-cases/operator/upload-attendance-media";
import { toggleAttendanceServiceItemUseCase } from "@/backend/use-cases/tenant/toggle-attendance-service-item";
import { updateAttendanceStatusUseCase } from "@/backend/use-cases/tenant/update-attendance-status";

export async function updateOperatorAttendanceStatusAction(formData: FormData) {
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (status === "ready") {
    await ensureReadyPhotoIfRequired(attendanceId);
  }
  await updateAttendanceStatusUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");
  redirect("/operador/dashboard?message=Status atualizado.");
}

export async function claimOperatorAttendanceAction(formData: FormData) {
  await claimAttendanceUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");
  redirect("/operador/dashboard?message=Carro assumido.");
}

export async function moveOperatorAttendanceToBoxAction(formData: FormData) {
  const context = await requireOperator();
  await moveAttendanceToBoxUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");

  const isAutomotiveTenant = (context.tenant.operational_profile ?? "automotive") === "automotive";
  const message = isAutomotiveTenant ? "Carro movido no pátio." : "Cliente movido no fluxo.";
  redirect(`/operador/dashboard?message=${encodeURIComponent(message)}`);
}

export async function uploadOperatorAttendanceMediaAction(formData: FormData) {
  await uploadAttendanceMediaUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");
  redirect("/operador/dashboard?message=Foto registrada.");
}

export async function toggleOperatorAttendanceServiceItemAction(formData: FormData) {
  await toggleAttendanceServiceItemUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");
  redirect("/operador/dashboard?message=Serviço do atendimento atualizado.");
}

export async function completeOperatorAttendanceReadyAction(formData: FormData) {
  await uploadAttendanceMediaUseCase(formData, { requiredKind: "ready" });
  await updateAttendanceStatusUseCase(formData);
  revalidatePath("/operador/dashboard");
  revalidatePath("/app/dashboard");
  redirect("/operador/dashboard?message=Carro pronto com foto final registrada.");
}

export async function createOperatorInventoryShelfAction(formData: FormData) {
  await createOperatorInventoryShelfUseCase(formData);
  revalidatePath("/operador/dashboard");
  redirect("/operador/dashboard?message=Prateleira criada.");
}

export async function createOperatorInventoryItemAction(formData: FormData) {
  await createOperatorInventoryItemUseCase(formData);
  revalidatePath("/operador/dashboard");
  redirect("/operador/dashboard?message=Item de estoque cadastrado.");
}

export async function quickOperatorInventoryEntryAction(formData: FormData) {
  await quickOperatorInventoryEntryUseCase(formData);
  revalidatePath("/operador/dashboard");
  redirect("/operador/dashboard?message=Entrada registrada no estoque.");
}

export async function registerOperatorInventoryMovementAction(formData: FormData) {
  await registerOperatorInventoryMovementUseCase(formData);
  revalidatePath("/operador/dashboard");
  redirect("/operador/dashboard?message=Movimentação registrada.");
}
