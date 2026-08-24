import type { ServiceRecord } from "@/backend/types";

export type VehicleTypeCode =
  | "hatch"
  | "sedan"
  | "wagon"
  | "pickup_small"
  | "suv"
  | "pickup_large"
  | "van"
  | "micro_bus"
  | "truck"
  | "bus";

export type VehicleSizeTier = "passeio" | "medio" | "grande" | "bem_grande";
export type VehicleTierOverrides = Partial<Record<VehicleTypeCode, VehicleSizeTier>>;

export const VEHICLE_TYPE_OPTIONS: Array<{
  code: VehicleTypeCode;
  label: string;
  tier: VehicleSizeTier;
}> = [
  { code: "hatch", label: "Hatch", tier: "passeio" },
  { code: "sedan", label: "Sedan", tier: "medio" },
  { code: "wagon", label: "Perua / Wagon", tier: "medio" },
  { code: "pickup_small", label: "Pickup pequena", tier: "grande" },
  { code: "suv", label: "SUV", tier: "grande" },
  { code: "pickup_large", label: "Pickup grande", tier: "grande" },
  { code: "van", label: "Van", tier: "grande" },
  { code: "micro_bus", label: "Micro-ônibus", tier: "grande" },
  { code: "truck", label: "Caminhão", tier: "bem_grande" },
  { code: "bus", label: "Ônibus", tier: "bem_grande" },
];

export const VEHICLE_BRAND_MODELS = {
  Abarth: ["Fastback", "Pulse"],
  "Alfa Romeo": ["145", "146", "147", "156", "159", "Giulia", "Stelvio"],
  Audi: ["A1 Sportback", "A3 Hatch", "A3 Sedan", "A4 Sedan", "A5 Sportback", "A6 Sedan", "Q3", "Q5", "Q7", "RS6 Avant", "TT"],
  BMW: ["118i", "120i", "320i Sedan", "328i Sedan", "330e Sedan", "X1", "X3", "X4", "X5", "X6", "Z4"],
  BYD: ["Dolphin", "Dolphin Mini", "Han", "King", "Seal", "Shark", "Song Plus", "Song Pro", "Tan", "Yuan Plus"],
  "Caoa Chery": ["Arrizo 5", "Arrizo 6", "Tiggo 2", "Tiggo 3X", "Tiggo 5X", "Tiggo 7", "Tiggo 8"],
  Chevrolet: ["Agile", "Astra Hatch", "Astra Sedan", "Blazer", "Captiva", "Celta", "Classic", "Cobalt", "Corsa Hatch", "Corsa Sedan", "Cruze Hatch", "Cruze Sedan", "D20", "Kadett", "Meriva", "Montana", "Monza", "Omega", "Onix Hatch", "Onix Sedan", "Opala", "Prisma", "S-10 Cabine Dupla", "S-10 Cabine Simples", "Silverado", "Spin", "Tracker", "Trailblazer", "Vectra", "Zafira"],
  Chrysler: ["300C", "PT Cruiser", "Town & Country"],
  Citroën: ["Aircross", "Basalt", "Berlingo", "C3", "C3 Aircross", "C3 Picasso", "C4", "C4 Cactus", "C4 Lounge", "Jumpy"],
  Cupra: ["Formentor"],
  Dodge: ["Challenger", "Charger", "Dakota Cabine Dupla", "Dakota Cabine Simples", "Durango", "Journey", "Ram 1500", "Ram 2500", "Ram 3500", "Viper"],
  Fiat: ["147", "Argo", "Brava", "Cronos", "Doblo", "Elba", "Fastback", "Fiorino", "Freemont", "Grand Siena", "Idea", "Linea", "Marea", "Mobi", "Palio", "Panorama", "Premio", "Pulse", "Siena", "Stilo", "Strada Cabine Dupla", "Strada Cabine Simples", "Tempra", "Toro", "Tipo", "Uno"],
  Ford: ["Belina", "Bronco Sport", "Courier", "Del Rey", "EcoSport", "Edge", "Escort Hatch", "Escort Sedan", "Expedition", "F-1000", "F-250", "Fiesta Hatch", "Fiesta Sedan", "Focus Hatch", "Focus Sedan", "Fusion", "Galaxie", "Ka Hatch", "Ka Sedan", "Maverick", "Mustang", "Pampa", "Ranger Cabine Dupla", "Ranger Cabine Simples", "Territory", "Transit", "Verona"],
  Ferrari: ["296 GTB", "488 GTB", "812 GTS", "California", "F8 Tributo", "Purosangue", "Roma", "SF90 Stradale"],
  Geely: ["Coolray", "EC7", "EX5", "Geometry C", "Okavango"],
  GWM: ["Haval H6", "Haval H6 GT", "Jolion", "Ora 03", "Poer", "Tank 300"],
  Honda: ["Accord", "City Hatch", "City Sedan", "Civic Hatch", "Civic Sedan", "CR-V", "Fit", "HR-V", "Passport", "WR-V"],
  Hyundai: ["Azera", "Creta", "Elantra", "HB20 Hatch", "HB20 Sedan", "HR", "i30", "Santa Fe", "Tucson", "Veloster", "Veracruz", "ix35"],
  Infiniti: ["FX35", "Q50", "QX60"],
  Iveco: ["Daily", "Tector"],
  JAC: ["E-JS1", "J2", "J3", "J5", "T40", "T50", "T60"],
  Jaguar: ["E-Pace", "F-Pace", "F-Type", "XE", "XF"],
  Jeep: ["Cherokee", "Commander", "Compass", "Gladiator", "Grand Cherokee", "Renegade", "Wrangler"],
  Kia: ["Bongo", "Carnival", "Cerato", "Mohave", "Picanto", "Seltos", "Sorento", "Soul", "Sportage"],
  Lamborghini: ["Huracán", "Urus"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Evoque", "Freelander 2", "Range Rover", "Range Rover Sport", "Velar"],
  Lexus: ["CT200h", "ES 300h", "NX 350h", "RX 450h", "UX 250h"],
  Maserati: ["Ghibli", "GranTurismo", "Levante", "MC20", "Quattroporte"],
  Mazda: ["CX-5", "MX-5", "RX-8"],
  McLaren: ["570S", "720S", "Artura"],
  "Mercedes-Benz": ["A 200", "B 200", "C 180", "C 200", "CLA 200", "CLS 400", "E 250", "GLA 200", "GLB 200", "GLC 220d", "GLE 400d", "S 500", "Sprinter"],
  Mini: ["Cooper 3 Portas", "Cooper 5 Portas", "Cooper S", "Countryman"],
  Mitsubishi: ["ASX", "Eclipse Cross", "L200 Triton Cabine Dupla", "L200 Triton Cabine Simples", "Outlander", "Pajero Full", "Pajero Sport"],
  Nissan: ["370Z", "Frontier Cabine Dupla", "Frontier Cabine Simples", "Kicks", "Leaf", "Livina", "March", "Pathfinder", "Sentra", "Tiida", "Versa", "X-Trail"],
  Peugeot: ["106", "206", "207", "208", "2008", "3008", "306", "307", "308", "405", "408", "508", "Boxer", "Expert", "Hoggar", "Partner"],
  Porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  Ram: ["Rampage", "1500", "2500", "3500", "Classic"],
  Renault: ["Captur", "Clio Hatch", "Clio Sedan", "Duster", "Fluence", "Kardian", "Kwid", "Logan", "Master", "Megane Hatch", "Megane Sedan", "Oroch", "Sandero", "Scenic", "Symbol", "Twingo"],
  "Rolls-Royce": ["Cullinan", "Ghost"],
  Subaru: ["Forester", "Impreza", "Legacy", "Outback", "WRX"],
  Suzuki: ["Grand Vitara", "Jimny", "SX4", "Vitara"],
  Tesla: ["Cybertruck", "Model 3", "Model S", "Model X", "Model Y"],
  Toyota: ["Bandeirante", "Corolla Cross", "Corolla Fielder", "Corolla Sedan", "Etios Hatch", "Etios Sedan", "Hilux Cabine Dupla", "Hilux Cabine Simples", "RAV4", "SW4", "Yaris Hatch", "Yaris Sedan"],
  Troller: ["T4"],
  Volkswagen: ["Amarok Cabine Dupla", "Amarok Cabine Simples", "Brasilia", "CrossFox", "Fusca", "Fox", "Gol", "Jetta", "Kombi", "Logus", "Nivus", "Parati", "Passat", "Polo Hatch", "Polo Sedan", "Santana", "Saveiro Cabine Simples", "SpaceFox", "T-Cross", "Taos", "Tiguan", "Up", "Variant", "Virtus", "Voyage"],
  Volvo: ["C40", "S60", "S90", "XC40", "XC60", "XC90"],
} as const;

export const VEHICLE_BRAND_OPTIONS = Object.keys(VEHICLE_BRAND_MODELS).sort((a, b) => a.localeCompare(b, "pt-BR"));

export const VEHICLE_COLOR_OPTIONS = [
  "Amarelo",
  "Azul",
  "Azul Marinho",
  "Bege",
  "Branco",
  "Bronze",
  "Champagne",
  "Cinza",
  "Cinza Chumbo",
  "Cinza Grafite",
  "Dourado",
  "Grafite",
  "Laranja",
  "Marrom",
  "Prata",
  "Preto",
  "Rosa",
  "Roxo",
  "Verde",
  "Verde Musgo",
  "Vermelho",
  "Vinho",
] as const;

export function getVehicleTypeMeta(vehicleType: string | null | undefined) {
  return VEHICLE_TYPE_OPTIONS.find((item) => item.code === vehicleType) ?? null;
}

export function getVehicleTypeOptions(overrides: VehicleTierOverrides = {}) {
  return VEHICLE_TYPE_OPTIONS.map((option) => ({ ...option, tier: overrides[option.code] ?? option.tier }));
}

export function getVehicleSizeTierLabel(tier: VehicleSizeTier) {
  if (tier === "passeio") return "Pequeno";
  if (tier === "medio") return "Médio";
  if (tier === "grande") return "Grande";
  return "X Grande";
}

export function getVehicleLabelByType(vehicleType: string | null | undefined) {
  return getVehicleTypeMeta(vehicleType)?.label ?? "Veículo";
}

export function getVehicleModelsForBrand(brand: string | null | undefined) {
  if (!brand) {
    return VEHICLE_BRAND_OPTIONS.flatMap((item) => [...VEHICLE_BRAND_MODELS[item as keyof typeof VEHICLE_BRAND_MODELS]]).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }

  const matchedBrand = VEHICLE_BRAND_OPTIONS.find((item) => item.toLowerCase() === brand.trim().toLowerCase());
  if (!matchedBrand) return [];
  return [...VEHICLE_BRAND_MODELS[matchedBrand as keyof typeof VEHICLE_BRAND_MODELS]];
}

export function normalizeAutocompleteChoice(value: string | null | undefined, options: readonly string[]) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const exact = options.find((item) => item.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const startsWith = options.filter((item) => item.toLowerCase().startsWith(raw.toLowerCase()));
  if (startsWith.length === 1) return startsWith[0];

  return raw;
}

export function formatVehicleDisplayLabel(input: {
  brand?: string | null;
  model?: string | null;
  vehicleType?: string | null;
}) {
  const brand = String(input.brand ?? "").trim();
  const model = String(input.model ?? "").trim();

  if (brand && model) return `${brand} ${model}`;
  if (model) return model;
  if (brand) return brand;

  return getVehicleLabelByType(input.vehicleType);
}

export function resolveServicePriceByVehicleType(
  service: ServiceRecord,
  vehicleType: string | null | undefined,
  overrides: VehicleTierOverrides = {},
  priceTable: "particular" | "app" = "particular",
) {
  const tier = overrides[String(vehicleType) as VehicleTypeCode] ?? getVehicleTypeMeta(vehicleType)?.tier ?? "passeio";

  if (priceTable === "app") {
    if (tier === "medio") return Number(service.price_app_medio ?? service.price_medio ?? service.price);
    if (tier === "grande") return Number(service.price_app_grande ?? service.price_grande ?? service.price);
    if (tier === "bem_grande") return Number(service.price_app_bem_grande ?? service.price_bem_grande ?? service.price);
    return Number(service.price_app_passeio ?? service.price_passeio ?? service.price);
  }

  if (tier === "medio") return Number(service.price_medio ?? service.price);
  if (tier === "grande") return Number(service.price_grande ?? service.price);
  if (tier === "bem_grande") return Number(service.price_bem_grande ?? service.price);

  return Number(service.price_passeio ?? service.price);
}

export function resolveServiceMinutesByVehicleType(service: ServiceRecord, vehicleType: string | null | undefined, overrides: VehicleTierOverrides = {}) {
  const tier = overrides[String(vehicleType) as VehicleTypeCode] ?? getVehicleTypeMeta(vehicleType)?.tier ?? "passeio";

  if (tier === "medio") return Number(service.minutes_medio ?? service.average_minutes);
  if (tier === "grande") return Number(service.minutes_grande ?? service.average_minutes);
  if (tier === "bem_grande") return Number(service.minutes_bem_grande ?? service.average_minutes);

  return Number(service.minutes_passeio ?? service.average_minutes);
}
