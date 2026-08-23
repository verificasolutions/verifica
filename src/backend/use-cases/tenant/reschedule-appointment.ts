import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getAppointmentById, updateAppointmentForTenant } from "@/backend/repos/appointments-repo";

export async function rescheduleAppointmentUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();

  if (!appointmentId || !date || !time) {
    redirect("/app/dashboard?error=Informe data e horário para reagendar.");
  }

  const appointment = await getAppointmentById(context.tenantId, appointmentId);
  if (!appointment || appointment.status !== "scheduled") {
    redirect("/app/dashboard?error=Agendamento não encontrado.");
  }

  const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
  if (Number.isNaN(new Date(scheduledFor).getTime())) {
    redirect("/app/dashboard?error=Data ou horário inválido.");
  }

  const error = await updateAppointmentForTenant({
    tenantId: context.tenantId,
    appointmentId,
    scheduledFor,
    status: "scheduled",
  });

  if (error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
