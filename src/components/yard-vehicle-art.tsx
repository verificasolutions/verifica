type YardVehicleArtProps = {
  vehicleType: string | null | undefined;
  color?: string | null | undefined;
  stage: "entry" | "wash" | "dry" | "finish" | "ready";
  compact?: boolean;
};

function resolveVehicleAsset(
  vehicleType: string | null | undefined,
  stage: YardVehicleArtProps["stage"],
) {
  if (stage === "wash") return "/yard-vehicles-ref/wash-car-topdown.png";

  switch (vehicleType) {
    case "sedan":
      return "/yard-vehicles-ref/sedan-silhouette.png";
    case "suv":
      return "/yard-vehicles-ref/suv-silhouette.png";
    case "pickup_small":
    case "pickup_large":
      return "/yard-vehicles-ref/pickup-silhouette.png";
    case "van":
      return "/yard-vehicles-ref/van-silhouette.png";
    case "micro_bus":
      return "/yard-vehicles-ref/micro_bus-silhouette.png";
    case "truck":
      return "/yard-vehicles-ref/truck-silhouette.png";
    case "bus":
      return "/yard-vehicles-ref/bus-silhouette.png";
    default:
      return "/yard-vehicles-ref/hatch-silhouette.png";
  }
}

function stageGlow(stage: YardVehicleArtProps["stage"]) {
  if (stage === "wash") return "drop-shadow-[0_0_32px_rgba(34,211,238,0.30)]";
  if (stage === "dry") return "drop-shadow-[0_0_30px_rgba(251,191,36,0.22)]";
  if (stage === "ready") return "drop-shadow-[0_0_36px_rgba(74,222,128,0.22)]";
  if (stage === "finish") return "drop-shadow-[0_0_24px_rgba(255,255,255,0.14)]";
  return "drop-shadow-[0_0_22px_rgba(255,255,255,0.10)]";
}

function WaterJets() {
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 220 168" fill="none">
        <path d="M32 42 C48 46 58 56 68 72" stroke="#67e8f9" strokeWidth="3.6" strokeLinecap="round" strokeDasharray="2 7" opacity="0.92" />
        <path d="M38 126 C50 118 60 108 68 92" stroke="#22d3ee" strokeWidth="3.6" strokeLinecap="round" strokeDasharray="2 7" opacity="0.74" />
        <path d="M188 42 C172 46 162 56 152 72" stroke="#67e8f9" strokeWidth="3.6" strokeLinecap="round" strokeDasharray="2 7" opacity="0.92" />
        <path d="M182 126 C170 118 160 108 152 92" stroke="#22d3ee" strokeWidth="3.6" strokeLinecap="round" strokeDasharray="2 7" opacity="0.74" />
      </svg>
      <div className="pointer-events-none absolute left-4 top-[38px] h-12 w-12 rounded-full border border-cyan-300/40 bg-[radial-gradient(circle,rgba(34,211,238,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute left-6 bottom-[28px] h-10 w-10 rounded-full border border-cyan-300/35 bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_70%)]" />
      <div className="pointer-events-none absolute right-4 top-[38px] h-12 w-12 rounded-full border border-cyan-300/40 bg-[radial-gradient(circle,rgba(34,211,238,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute right-6 bottom-[28px] h-10 w-10 rounded-full border border-cyan-300/35 bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_70%)]" />
    </>
  );
}

function stageMask(stage: YardVehicleArtProps["stage"]) {
  if (stage === "wash") return "linear-gradient(to bottom, transparent 0%, black 8%, black 100%)";
  return "linear-gradient(to bottom, black 0%, black 84%, transparent 100%)";
}

function stageImageSize(stage: YardVehicleArtProps["stage"]) {
  if (stage === "wash") return "h-[158px] w-[124px]";
  if (stage === "dry") return "h-[128px] w-[206px]";
  if (stage === "entry") return "h-[132px] w-[186px]";
  return "h-[132px] w-[206px]";
}

export function YardVehicleArt({ vehicleType, stage }: YardVehicleArtProps) {
  return (
    <div className="relative h-[168px] overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_66%),linear-gradient(180deg,rgba(15,23,42,0.12),rgba(2,6,23,0.46))]">
      {stage === "wash" ? <WaterJets /> : null}
      <div className={`absolute inset-0 flex items-center justify-center ${stageGlow(stage)}`}>
        <img
          src={resolveVehicleAsset(vehicleType, stage)}
          alt="Veículo"
          className={`${stageImageSize(stage)} object-contain object-center ${stage === "entry" ? "brightness-[0.88] saturate-[0.72] sepia-[0.22]" : ""}`}
          style={{
            WebkitMaskImage: stageMask(stage),
            maskImage: stageMask(stage),
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
          draggable="false"
        />
      </div>
    </div>
  );
}
