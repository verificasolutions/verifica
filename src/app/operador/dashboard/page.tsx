import Link from "next/link";
import { signOutAction } from "@/app/login/actions";
import { FlashNotice } from "@/components/flash-notice";
import { OperatorInventorySection } from "@/components/operator-inventory-section";
import { RealtimeRefreshBridge } from "@/components/realtime-refresh-bridge";
import { listSelectableDestinationBoxes, resolveNextBoxForFlow } from "@/backend/shared/operation-box-flow";
import { resolveAttendancePrimaryServiceName, resolveAttendanceServiceDisplayName } from "@/backend/shared/attendance-service-summary";
import { resolvePostWashStatus } from "@/backend/shared/service-flow";
import { getOperatorDashboardUseCase } from "@/backend/use-cases/operator/get-operator-dashboard";
import { getOperatorInventoryWorkspaceUseCase } from "@/backend/use-cases/operator/get-operator-inventory-workspace";
import { SubmitActionButton } from "./submit-action-button";
import {
  claimOperatorAttendanceAction,
  completeOperatorAttendanceReadyAction,
  moveOperatorAttendanceToBoxAction,
  toggleOperatorAttendanceServiceItemAction,
  updateOperatorAttendanceStatusAction,
  uploadOperatorAttendanceMediaAction,
} from "./actions";

export const maxDuration = 300;

function nextStatus(item: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["mine"][number]) {
  switch (item.status) {
    case "waiting":
      return { label: "Iniciar lavagem", status: "washing" };
    case "washing":
      return resolvePostWashStatus(resolveAttendancePrimaryServiceName(item)) === "ready"
        ? { label: "Ir para retirada", status: "ready" }
        : { label: "Ir para finalizacao", status: "finishing" };
    case "finishing":
      return { label: "Marcar como pronto", status: "ready" };
    default:
      return null;
  }
}

function resolveNextBox(
  item: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["mine"][number],
  boxes: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["operationBoxes"],
  queue: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["queue"],
) {
  const nextBox = resolveNextBoxForFlow({
    boxes,
    queue,
    currentBoxId: item.current_box_id,
    serviceName: resolveAttendancePrimaryServiceName(item),
  });
  if (!nextBox) return null;

  return { box: nextBox, label: `Mover para ${nextBox.name}` };
}

function resolveSelectableBoxes(
  item: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["mine"][number],
  boxes: Awaited<ReturnType<typeof getOperatorDashboardUseCase>>["operationBoxes"],
) {
  return listSelectableDestinationBoxes({
    boxes,
    currentBoxId: item.current_box_id,
  });
}

function badgeTone(status: string) {
  if (status === "waiting") return "border-amber-400/30 bg-amber-400/12 text-amber-100";
  if (status === "washing" || status === "finishing") return "border-sky-400/30 bg-sky-400/12 text-sky-100";
  if (status === "ready") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";
  return "border-white/10 bg-white/6 text-white/72";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function describeSla(item: {
  estimated_minutes: number | null;
  started_at?: string | null;
  created_at: string;
}) {
  const estimated = Number(item.estimated_minutes ?? 0);
  if (!Number.isFinite(estimated) || estimated <= 0) {
    return "SLA livre";
  }

  if (!item.started_at) {
    return "Aguardando inicio";
  }

  const elapsed = Math.max(0, Math.round((Date.now() - new Date(item.started_at).getTime()) / 60000));
  const remaining = estimated - elapsed;

  if (remaining < 0) {
    return `${Math.abs(remaining)} min atrasado`;
  }

  return `${remaining} min restantes`;
}

export default async function OperatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; shelfId?: string; inventoryBarcode?: string; inventoryQty?: string }>;
}) {
  const params = await searchParams;
  const dashboard = await getOperatorDashboardUseCase();
  const inventory =
    dashboard.settings?.operator_inventory_enabled
      ? await getOperatorInventoryWorkspaceUseCase({
          selectedShelfId: (params.shelfId ?? "").trim() || null,
          pendingBarcode: (params.inventoryBarcode ?? "").trim() || null,
          pendingQuantity: (params.inventoryQty ?? "").trim() || null,
        })
      : null;
  const boxesMode = dashboard.settings?.operations_mode === "boxes";
  const operationFlowLocked = dashboard.settings?.operation_flow_locked ?? true;
  const canEditStatus = dashboard.settings?.operator_can_edit_status ?? true;
  const canViewCustomerPhone = dashboard.settings?.operator_can_view_customer_phone ?? false;
  const isAutomotiveTenant = (dashboard.tenant.operational_profile ?? "automotive") === "automotive";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-5 pb-12">
      <RealtimeRefreshBridge tenantId={dashboard.tenantId} scope="operator" />
      <section className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_50%),rgba(22,27,34,0.92)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/62">Ola, {dashboard.actor.firstName}</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Hoje: {dashboard.stats.assignedToday} {isAutomotiveTenant ? "lavagens atribuídas" : "serviços atribuídos"}
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/42">
              {boxesMode ? "Modo boxes ativo" : "Modo classico ativo"}
            </p>
          </div>
          <form action={signOutAction}>
            <button className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">Sair</button>
          </form>
        </div>
      </section>

      <FlashNotice error={params.error} message={params.message} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Minha fila", value: dashboard.mine.length },
          { label: "Andamento", value: dashboard.stats.inProgress },
          { label: "Prontos", value: dashboard.stats.ready },
        ].map((item) => (
          <section key={item.label} className="rounded-[22px] border border-white/10 bg-white/6 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-white/38">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
          </section>
        ))}
      </div>

      <section className="rounded-[22px] border border-white/10 bg-white/6 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-white/42">Minha operação</p>
        <div className="mt-4 space-y-3">
          {dashboard.mine.map((item) => {
            const transition = nextStatus(item);
            const nextBox = resolveNextBox(item, dashboard.operationBoxes, dashboard.queue);
            const selectableBoxes = resolveSelectableBoxes(item, dashboard.operationBoxes);
            const vehicleLabel = `${item.vehicles?.model ?? "Veículo"}${item.vehicles?.color ? ` ${item.vehicles.color}` : ""}`;
            const itemTitle = isAutomotiveTenant ? vehicleLabel : item.customers?.name ?? "Cliente";
            const currentBoxName = dashboard.operationBoxes.find((box) => box.id === item.current_box_id)?.name ?? "Sem box";
            const stepPhotos = item.media?.filter((media) => media.kind === "step") ?? [];
            const readyPhotos = item.media?.filter((media) => media.kind === "ready") ?? [];

            return (
              <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{itemTitle}</p>
                    {isAutomotiveTenant ? <p className="text-sm text-white/55">{item.vehicles?.plate ?? "Sem placa"}</p> : null}
                    {canViewCustomerPhone && item.customers?.whatsapp ? <p className="mt-1 text-sm text-white/55">{item.customers.whatsapp}</p> : null}
                    <p className="mt-2 text-sm text-white/72">{resolveAttendanceServiceDisplayName(item)}</p>
                    <p className="mt-2 text-xs text-white/52">Entrada: {formatDateTime(item.created_at)}</p>
                    <p className="mt-1 text-xs font-medium text-white/72">SLA: {describeSla(item)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                {boxesMode ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                    Box atual: <span className="font-medium text-white">{currentBoxName}</span>
                  </div>
                ) : null}

                {(item.service_items?.length ?? 0) > 0 ? (
                  <div className="mt-3 space-y-2">
                    {item.service_items!.map((serviceItem) => (
                      <form key={serviceItem.id} action={toggleOperatorAttendanceServiceItemAction} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <input type="hidden" name="redirect_to" value="/operador/dashboard" />
                        <input type="hidden" name="attendance_id" value={item.id} />
                        <input type="hidden" name="item_id" value={serviceItem.id} />
                        <input type="hidden" name="next_status" value={serviceItem.status === "completed" ? "pending" : "completed"} />
                        <button
                          className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${
                            serviceItem.status === "completed"
                              ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                              : "border-white/15 bg-black/20 text-white/50"
                          }`}
                        >
                          {serviceItem.status === "completed" ? "OK" : ""}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${serviceItem.status === "completed" ? "text-emerald-100" : "text-white/84"}`}>{serviceItem.name}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {serviceItem.status === "completed"
                              ? "Concluído"
                              : serviceItem.estimated_minutes
                                ? `${serviceItem.estimated_minutes} min`
                                : "Sem prazo"}
                          </p>
                        </div>
                      </form>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {canEditStatus && boxesMode && operationFlowLocked && nextBox ? (
                    <form action={moveOperatorAttendanceToBoxAction}>
                      <input type="hidden" name="attendance_id" value={item.id} />
                      <input type="hidden" name="box_id" value={nextBox.box.id} />
                      <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                        {nextBox.label}
                      </button>
                    </form>
                  ) : canEditStatus && !boxesMode && transition ? (
                    <form action={updateOperatorAttendanceStatusAction}>
                      <input type="hidden" name="attendance_id" value={item.id} />
                      <input type="hidden" name="tenant_id" value={item.tenant_id} />
                      <input type="hidden" name="status" value={transition.status} />
                      <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                        {transition.label}
                      </button>
                    </form>
                  ) : (
                    <div />
                  )}

                  <Link href={`/acompanhar/${item.public_code}`} className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82">
                    Link público
                  </Link>
                </div>

                {boxesMode && !operationFlowLocked && selectableBoxes.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Mover para</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {canEditStatus ? (
                        selectableBoxes.map((box) => (
                          <form key={box.id} action={moveOperatorAttendanceToBoxAction}>
                            <input type="hidden" name="attendance_id" value={item.id} />
                            <input type="hidden" name="box_id" value={box.id} />
                            <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-medium text-white/82">
                              {box.name}
                            </button>
                          </form>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/62 sm:col-span-2">
                          Fluxo bloqueado para este operador
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {dashboard.settings?.allow_step_photos ? (
                  <>
                    {(stepPhotos.length > 0 || readyPhotos.length > 0) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {stepPhotos.length > 0 ? (
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                            Foto da etapa anexada
                          </span>
                        ) : null}
                        {readyPhotos.length > 0 ? (
                          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">
                            Foto final anexada
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <form action={uploadOperatorAttendanceMediaAction} className="mt-3 space-y-2">
                      <input type="hidden" name="attendance_id" value={item.id} />
                      <input type="hidden" name="kind" value="step" />
                      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-white/72 file:mr-4 file:rounded-2xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white" />
                      <input name="caption" placeholder="Legenda opcional da etapa" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                      <SubmitActionButton
                        idleLabel="Registrar foto da etapa"
                        pendingLabel="Registrando foto..."
                        className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82"
                      />
                    </form>
                  </>
                ) : null}

                {transition?.status === "ready" && dashboard.settings?.require_ready_photo ? (
                  <form action={completeOperatorAttendanceReadyAction} className="mt-3 space-y-2">
                    <input type="hidden" name="attendance_id" value={item.id} />
                    <input type="hidden" name="tenant_id" value={item.tenant_id} />
                    <input type="hidden" name="status" value="ready" />
                    <input type="hidden" name="kind" value="ready" />
                    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-white/72 file:mr-4 file:rounded-2xl file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950" />
                    <input name="caption" placeholder="Legenda opcional da foto final" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                    <SubmitActionButton
                      idleLabel="Pronto com foto final"
                      pendingLabel="Enviando foto final..."
                      className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-emerald-400 px-4 text-sm font-semibold text-slate-950"
                    />
                  </form>
                ) : null}
              </div>
            );
          })}

          {dashboard.mine.length === 0 ? (
            <div className="rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm text-white/58">
              {isAutomotiveTenant ? "Nenhum carro atribuído a você ainda." : "Nenhum serviço atribuído a você ainda."}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-white/6 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-white/42">{isAutomotiveTenant ? "Carros disponiveis" : "Clientes disponiveis"}</p>
        <div className="mt-4 space-y-3">
          {dashboard.available.map((item) => {
            const currentBoxName = dashboard.operationBoxes.find((box) => box.id === item.current_box_id)?.name ?? "Esteira";
            const itemTitle = isAutomotiveTenant ? item.vehicles?.model ?? "Veículo" : item.customers?.name ?? "Cliente";

            return (
              <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                <p className="text-lg font-semibold text-white">{itemTitle}</p>
                {isAutomotiveTenant ? <p className="text-sm text-white/55">{item.vehicles?.plate ?? "Sem placa"}</p> : null}
                {canViewCustomerPhone && item.customers?.whatsapp ? <p className="mt-1 text-sm text-white/55">{item.customers.whatsapp}</p> : null}
                <p className="mt-2 text-sm text-white/72">{resolveAttendanceServiceDisplayName(item)}</p>
                <p className="mt-2 text-xs text-white/52">Entrada: {formatDateTime(item.created_at)}</p>
                <p className="mt-1 text-xs font-medium text-white/72">SLA: {describeSla(item)}</p>
                {boxesMode ? <p className="mt-2 text-sm text-white/55">Posicao atual: {currentBoxName}</p> : null}
                <form action={claimOperatorAttendanceAction} className="mt-3">
                  <input type="hidden" name="attendance_id" value={item.id} />
                  <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82">
                    {isAutomotiveTenant ? "Assumir carro" : "Assumir cliente"}
                  </button>
                </form>
              </div>
            );
          })}

          {dashboard.available.length === 0 ? (
            <div className="rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm text-white/58">
              {isAutomotiveTenant ? "Nenhum carro aguardando sem responsavel." : "Nenhum cliente aguardando sem responsavel."}
            </div>
          ) : null}
        </div>
      </section>

      {inventory ? <OperatorInventorySection inventory={inventory} /> : null}
    </main>
  );
}
