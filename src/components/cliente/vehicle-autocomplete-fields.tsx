"use client";

import { useMemo, useState } from "react";
import { VEHICLE_BRAND_OPTIONS, VEHICLE_COLOR_OPTIONS, VEHICLE_TYPE_OPTIONS, getVehicleModelsForBrand } from "@/backend/shared/vehicle-catalog";

const tierByType: Record<string, string> = { hatch: "passeio", sedan: "medio", wagon: "medio", pickup_small: "grande", suv: "grande", pickup_large: "grande", van: "bem_grande", micro_bus: "bem_grande", truck: "bem_grande", bus: "bem_grande" };

function resolveTypeCode(value: string) {
  const normalized = value.trim().toLowerCase();
  const exact = VEHICLE_TYPE_OPTIONS.find((option) => option.code === normalized || option.label.toLowerCase() === normalized);
  if (exact) return exact.code;
  if (normalized.includes("micro") || normalized.includes("ônibus") || normalized.includes("onibus")) return "micro_bus";
  if (normalized.includes("caminh") || normalized.includes("truck")) return "truck";
  if (normalized.includes("van")) return "van";
  if (normalized.includes("pickup") || normalized.includes("pick-up")) return "pickup_large";
  if (normalized.includes("suv")) return "suv";
  if (normalized.includes("sedan")) return "sedan";
  if (normalized.includes("hatch")) return "hatch";
  return normalized;
}

export function VehicleAutocompleteFields({ brand = "", model = "", color = "", vehicleType = "" }: { brand?: string; model?: string; color?: string; vehicleType?: string }) {
  const [brandValue, setBrandValue] = useState(brand);
  const [typeValue, setTypeValue] = useState(vehicleType);
  const models = useMemo(() => getVehicleModelsForBrand(brandValue), [brandValue]);
  const typeCode = resolveTypeCode(typeValue);
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-[color:var(--text-secondary)]">Marca<input name="brand" defaultValue={brand} list="portal-vehicle-brands" onChange={(event) => setBrandValue(event.target.value)} placeholder="Marca" className="mt-1 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-sm outline-none" /><datalist id="portal-vehicle-brands">{VEHICLE_BRAND_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist></label><label className="block text-xs font-medium text-[color:var(--text-secondary)]">Modelo<input name="model" defaultValue={model} list="portal-vehicle-models" placeholder="Modelo" className="mt-1 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-sm outline-none" /><datalist id="portal-vehicle-models">{models.map((option) => <option key={option} value={option} />)}</datalist></label></div><div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-[color:var(--text-secondary)]">Cor<input name="color" defaultValue={color} list="portal-vehicle-colors" placeholder="Cor" className="mt-1 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-sm outline-none" /><datalist id="portal-vehicle-colors">{VEHICLE_COLOR_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist></label><label className="block text-xs font-medium text-[color:var(--text-secondary)]">Tipo<input name="vehicle_type_label" defaultValue={vehicleType} list="portal-vehicle-types" onChange={(event) => setTypeValue(event.target.value)} placeholder="Hatch, sedan, SUV..." className="mt-1 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-sm outline-none" /><datalist id="portal-vehicle-types">{VEHICLE_TYPE_OPTIONS.map((option) => <option key={option.code} value={option.label} />)}</datalist></label></div><input type="hidden" name="vehicle_type" value={typeCode} /><input type="hidden" name="size_tier" value={tierByType[typeCode] ?? "passeio"} /><p className="text-[11px] text-[color:var(--text-soft)]">O porte é calculado automaticamente pelo tipo do veículo.</p></div>;
}
