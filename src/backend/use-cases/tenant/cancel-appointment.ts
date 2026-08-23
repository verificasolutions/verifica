import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getAppointmentById, updateAppointmentForTenant } from "@/backend/repos/appointments-repo";

export async function cancelAppointmentUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();

  if (!appointmentId) {
    redirect("/app/dashboard?error=Agendamento inválido.");
  }

  const appointment = await getAppointmentById(context.tenantId, appointmentId);
  if (!appointment || appointment.status !== "scheduled") {
    redirect("/app/dashboard?error=Agendamento não encontrado.");
  }

  const error = await updateAppointmentForTenant({
    tenantId: context.tenantId,
    appointmentId,
    status: "canceled",
  });

  if (error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
