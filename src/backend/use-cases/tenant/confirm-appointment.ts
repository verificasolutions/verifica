import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAttendanceServiceItemsForTenant } from "@/backend/repos/attendance-service-items-repo";
import { getAppointmentById, updateAppointmentForTenant } from "@/backend/repos/appointments-repo";
import {
  createAttendanceForTenant,
  createAttendancePublicStatus,
  findActiveAttendanceByVehicle,
  listQueueForTodayByTenant,
} from "@/backend/repos/attendances-operations-repo";
import { listOperationBoxesByTenant, moveAttendanceToBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { formatVehicleDisplayLabel, resolveServiceMinutesByVehicleType, resolveServicePriceByVehicleType } from "@/backend/shared/vehicle-catalog";

export async function confirmAppointmentUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();

  if (!appointmentId) {
    redirect("/app/dashboard?error=Agendamento invalido.");
  }

  const appointment = await getAppointmentById(context.tenantId, appointmentId);
  if (!appointment || appointment.status !== "scheduled") {
    redirect("/app/dashboard?error=Agendamento nao encontrado.");
  }

  if (!appointment.customer_id || !appointment.vehicle_id || !appointment.service_id) {
    redirect("/app/dashboard?error=Agendamento incompleto para entrada no fluxo.");
  }

  if (context.tenant.operational_profile === "automotive") {
    const activeAttendance = await findActiveAttendanceByVehicle({
      tenantId: context.tenantId,
      vehicleId: appointment.vehicle_id,
    });

    if (activeAttendance) {
      redirect("/app/dashboard?error=Este veiculo ja esta em atendimento ativo na operacao.");
    }
  }

  const services = await listActiveServicesByTenant(context.tenantId);
  const settings = await getTenantSettings(context.tenantId);
  const service = services.find((item) => item.id === appointment.service_id);

  if (!service) {
    redirect("/app/dashboard?error=Servico do agendamento nao encontrado.");
  }

  const effectiveVehicleType = appointment.vehicles?.vehicle_type ?? null;
  const estimatedMinutes = resolveServiceMinutesByVehicleType(service, effectiveVehicleType, settings?.vehicle_type_tier_overrides ?? {});
  const finalPrice = resolveServicePriceByVehicleType(service, effectiveVehicleType, settings?.vehicle_type_tier_overrides ?? {});

  const createdAttendance = await createAttendanceForTenant({
    tenantId: context.tenantId,
    customerId: appointment.customer_id,
    vehicleId: appointment.vehicle_id,
    serviceId: appointment.service_id,
    serviceLabel: service.name,
    estimatedMinutes,
    extraMinutes: 0,
    finalPrice,
    paymentMethod: "pending",
    notifyCustomer: false,
  });

  if (createdAttendance.error || !createdAttendance.data) {
    redirect(`/app/dashboard?error=${encodeURIComponent(createdAttendance.error?.message ?? "Falha ao criar atendimento a partir do agendamento.")}`);
  }

  const serviceItems = await createAttendanceServiceItemsForTenant({
    tenantId: context.tenantId,
    attendanceId: createdAttendance.data.id,
    items: [
      {
        serviceId: service.id,
        name: service.name,
        estimatedMinutes,
        unitPrice: finalPrice,
        isPrimary: true,
      },
    ],
  });

  if (serviceItems.error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(serviceItems.error.message)}`);
  }

  const [operationBoxes, currentQueue] = await Promise.all([
    listOperationBoxesByTenant(context.tenantId),
    listQueueForTodayByTenant(context.tenantId),
  ]);

  const entryBox =
    operationBoxes.find((box) => box.kind === "entry" && box.is_active) ??
    [...operationBoxes].sort((a, b) => a.sort_order - b.sort_order).find((box) => box.is_active) ??
    null;

  if (entryBox) {
    const queuePosition =
      currentQueue
        .filter((item) => item.status === "waiting")
        .reduce((max, item) => Math.max(max, item.queue_position ?? 0), 0) + 1;

    const moveError = await moveAttendanceToBoxForTenant({
      attendanceId: createdAttendance.data.id,
      boxId: entryBox.id,
      queuePosition,
      note: "Chegada confirmada a partir do agendamento",
    });

    if (moveError) {
      redirect(`/app/dashboard?error=${encodeURIComponent(moveError.message)}`);
    }
  }

  const publicStatusError = await createAttendancePublicStatus({
    attendanceId: createdAttendance.data.id,
    publicCode: createdAttendance.data.public_code,
    vehicleLabel:
      context.tenant.operational_profile === "automotive"
        ? `${formatVehicleDisplayLabel(appointment.vehicles ?? {})}${appointment.vehicles?.color ? ` ${appointment.vehicles.color}` : ""}`.trim()
        : appointment.customers?.name ?? "Atendimento",
    status: "waiting",
    etaMinutes: estimatedMinutes,
    stepIndex: 2,
  });

  if (publicStatusError) {
    redirect(`/app/dashboard?error=${encodeURIComponent(publicStatusError.message)}`);
  }

  const appointmentUpdateError = await updateAppointmentForTenant({
    tenantId: context.tenantId,
    appointmentId,
    status: "completed",
  });

  if (appointmentUpdateError) {
    redirect(`/app/dashboard?error=${encodeURIComponent(appointmentUpdateError.message)}`);
  }
}
