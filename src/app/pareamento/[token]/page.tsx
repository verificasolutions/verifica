import { notFound } from "next/navigation";
import { PairingAutoRefresh } from "@/components/pairing-auto-refresh";
import { getEvolutionConnectionState, requestEvolutionConnectionCode } from "@/backend/integrations/evolution-admin";
import { getPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";
import { getTenantWhatsappPairingByToken } from "@/backend/repos/tenant-whatsapp-pairing-repo";

export const dynamic = "force-dynamic";

function buildQrImageSrc(value: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(value)}`;
}

function formatConnectionState(value: string | null) {
  if (!value) return "Não provisionado";

  const map: Record<string, string> = {
    open: "Conectado",
    close: "Desconectado",
    connecting: "Conectando",
    qrcode: "Aguardando pareamento",
  };

  return map[value] ?? value;
}

export default async function TenantWhatsappPairingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pairing = await getTenantWhatsappPairingByToken(token);

  if (!pairing?.tenants?.is_active) {
    notFound();
  }

  const platformSettings = await getPlatformSettingsAdmin();
  if (!platformSettings?.whatsapp_base_url || !platformSettings.evolution_api_key || !pairing.evolution_instance) {
    notFound();
  }

  const stateResult = await getEvolutionConnectionState({
    config: {
      baseUrl: platformSettings.whatsapp_base_url,
      masterApiKey: platformSettings.evolution_api_key,
    },
    instanceName: pairing.evolution_instance,
  });

  const connectionState = stateResult.ok ? stateResult.state ?? null : null;

  let pairingCode: string | null = null;
  let qrCode: string | null = null;
  let errorMessage: string | null = stateResult.ok ? null : stateResult.message ?? "Falha ao consultar a conexão.";

  if (connectionState !== "open") {
    const connectResult = await requestEvolutionConnectionCode({
      config: {
        baseUrl: platformSettings.whatsapp_base_url,
        masterApiKey: platformSettings.evolution_api_key,
      },
      instanceName: pairing.evolution_instance,
    });

    if (connectResult.ok) {
      pairingCode = connectResult.pairingCode ?? null;
      qrCode = connectResult.qrCode ?? null;
    } else {
      errorMessage = connectResult.message ?? "Falha ao gerar o pareamento.";
    }
  }

  const qrImage = buildQrImageSrc(qrCode);

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-8">
      <PairingAutoRefresh enabled={connectionState !== "open"} />

      <section className="mx-auto w-full max-w-[720px] rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.14),_transparent_55%),rgba(22,27,34,0.96)] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">Pareamento do WhatsApp</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{pairing.tenants?.name}</h1>
        <p className="mt-2 text-sm text-white/60">
          Status atual: <span className="font-semibold text-white">{formatConnectionState(connectionState)}</span>
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-[20px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{errorMessage}</div>
        ) : null}

        {connectionState === "open" ? (
          <div className="mt-5 rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-50">
            <p className="text-lg font-semibold text-white">WhatsApp conectado</p>
            <p className="mt-2 text-sm text-emerald-100/88">Essa conta já está pareada. Não é necessário escanear de novo.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-5">
            <p className="text-sm text-white/70">
              Abra este link em outro aparelho ou computador, ou escaneie agora pelo WhatsApp em
              `Configurações &gt; Aparelhos conectados`.
            </p>
            <p className="mt-4 text-base font-semibold text-white">Código curto: {pairingCode ?? "gerando..."}</p>

            {qrImage ? (
              <div className="mt-5 rounded-[24px] bg-white p-4">
                <img src={qrImage} alt="QR Code de pareamento do WhatsApp" className="mx-auto h-auto w-full max-w-[360px]" />
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-white/10 bg-[#0f141b] px-4 py-5 text-sm text-white/60">
                O QR está sendo renovado. Atualize esta página em alguns segundos.
              </div>
            )}

            <a
              href=""
              className="mt-5 flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86"
            >
              Atualizar QR agora
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
