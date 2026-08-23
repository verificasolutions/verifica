import { notFound } from "next/navigation";
import { YardVehicleArt } from "@/components/yard-vehicle-art";
import { getPublicTrackerUseCase } from "@/backend/use-cases/public/get-tracker";

const steps = ["Recebido", "Na fila", "Em lavagem", "Finalização", "Pronto"] as const;

function statusTitle(status: string, isAutomotive: boolean) {
  if (!isAutomotive) {
    switch (status) {
      case "waiting":
        return "Seu atendimento está na fila";
      case "washing":
        return "Seu atendimento está em execução";
      case "finishing":
        return "Seu atendimento está em conferência";
      case "ready":
      case "delivered":
        return "Seu atendimento está concluído";
      default:
        return "Acompanhar atendimento";
    }
  }

  switch (status) {
    case "waiting":
      return "Seu carro está na fila";
    case "washing":
      return "Seu carro está em lavagem";
    case "finishing":
      return "Seu carro está em finalização";
    case "ready":
    case "delivered":
      return "Seu carro está pronto para retirada";
    default:
      return "Acompanhar atendimento";
  }
}

function statusSubtitle(status: string, isAutomotive: boolean) {
  if (!isAutomotive) {
    switch (status) {
      case "waiting":
        return "Estamos organizando a entrada do seu atendimento no fluxo.";
      case "washing":
        return "Seu serviço já está em execução.";
      case "finishing":
        return "Seu atendimento está na etapa final de conferência.";
      case "ready":
      case "delivered":
        return "Seu atendimento foi concluído e está disponível para você.";
      default:
        return "Acompanhe a evolução do seu atendimento em tempo real.";
    }
  }

  switch (status) {
    case "waiting":
      return "Estamos organizando a entrada do seu veículo no box.";
    case "washing":
      return "Seu veículo já está passando pela etapa de lavagem.";
    case "finishing":
      return "Seu veículo está em secagem e acabamento final.";
    case "ready":
    case "delivered":
      return "Seu veículo está limpo e pronto para retirada.";
    default:
      return "Acompanhe a evolução do seu atendimento em tempo real.";
  }
}

function stageFromStatus(status: string): "entry" | "wash" | "dry" | "finish" | "ready" {
  if (status === "washing") return "wash";
  if (status === "finishing") return "dry";
  if (status === "ready" || status === "delivered") return "ready";
  return "entry";
}

function trackerTone(status: string) {
  if (status === "washing") return "border-cyan-300/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(15,23,42,0.92))]";
  if (status === "finishing") return "border-amber-300/30 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(15,23,42,0.92))]";
  if (status === "ready" || status === "delivered") return "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(74,222,128,0.16),rgba(15,23,42,0.92))]";
  return "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))]";
}

export default async function TrackerPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const tracker = await getPublicTrackerUseCase(codigo);

  if (!tracker) {
    notFound();
  }

  const activeIndex = Math.max(0, Math.min(4, (tracker.step_index ?? 1) - 1));
  const isAutomotive = tracker.operational_profile !== "generic";
  const stage = stageFromStatus(tracker.status);
  const whatsappHref = tracker.tenant_whatsapp
    ? `https://wa.me/55${tracker.tenant_whatsapp}?text=${encodeURIComponent(`Olá, vim pelo acompanhamento ${codigo} e preciso de ajuda.`)}`
    : null;
  const extraServiceHref = tracker.tenant_whatsapp
    ? `https://wa.me/55${tracker.tenant_whatsapp}?text=${encodeURIComponent(`Olá, quero solicitar um serviço extra para o atendimento ${codigo}.`)}`
    : null;
  const mapsHref = tracker.location_label
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tracker.location_label)}`
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/6 p-0 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="bg-[radial-gradient(circle_at_top,rgba(0,245,212,0.18),transparent_58%),linear-gradient(180deg,rgba(22,27,34,0.98),rgba(13,17,23,0.96))] p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]/78">Acompanhar atendimento</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">{statusTitle(tracker.status, isAutomotive)}</h1>
          <p className="mt-2 text-sm text-white/62">Código público: {codigo}</p>
        </div>

        <div className="space-y-5 p-5">
          <div className={`rounded-[24px] border p-4 ${trackerTone(tracker.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">{tracker.vehicle_label}</h2>
                <p className="mt-1 text-sm text-white/62">{statusSubtitle(tracker.status, isAutomotive)}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/70">
                {tracker.eta_minutes ?? 0} min
              </div>
            </div>

            {isAutomotive ? (
              <div className="mt-4">
                <YardVehicleArt
                  vehicleType={tracker.vehicle_type}
                  color={tracker.vehicle_color}
                  stage={stage}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/15 px-4 py-6 text-center text-sm text-white/68">
                Fluxo em andamento com atualização automática desta etapa.
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {steps.map((step, index) => {
              const done = index <= activeIndex;
              return (
                <div key={step} className="space-y-2 text-center">
                  <div
                    className={`mx-auto flex size-10 items-center justify-center rounded-full border text-xs font-semibold ${
                      done
                        ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_20px_rgba(74,222,128,0.28)]"
                        : "border-white/10 bg-white/5 text-white/38"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </div>
                  <p className="text-[11px] text-white/55">{step}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2">
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-emerald-300 px-4 text-sm font-semibold text-slate-950 shadow-[0_15px_40px_rgba(74,222,128,0.2)]"
              >
                {isAutomotive ? "Falar com o lava-rápido" : "Falar com a equipe"}
              </a>
            ) : null}
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82"
              >
                Ver localização
              </a>
            ) : null}
            {extraServiceHref ? (
              <a
                href={extraServiceHref}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82"
              >
                Solicitar serviço extra
              </a>
            ) : null}
          </div>

          {(tracker.status === "ready" || tracker.status === "delivered") ? (
            <section className="rounded-[22px] border border-emerald-300/15 bg-emerald-300/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">
                {isAutomotive ? "Seu carro está pronto para retirada." : "Seu atendimento foi concluído."}
              </p>
              <p className="mt-1 text-sm text-emerald-100/68">
                Aqui o cliente vê apenas a evolução do próprio atendimento.
              </p>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
