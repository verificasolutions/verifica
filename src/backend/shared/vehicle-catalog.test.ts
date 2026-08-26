import { describe, expect, it } from "vitest";
import { resolveServiceMinutesByVehicleType, resolveServicePriceByVehicleType } from "./vehicle-catalog";
import type { ServiceRecord } from "@/backend/types";

const service = {
  id: "s1",
  tenant_id: "t1",
  name: "Lavagem",
  base_service_id: null,
  time_unit: "minutes",
  price: 50,
  price_passeio: 40,
  price_medio: 50,
  price_grande: 60,
  price_bem_grande: 80,
  price_app_passeio: 35,
  price_app_medio: 45,
  price_app_grande: 55,
  price_app_bem_grande: 75,
  minutes_passeio: 20,
  minutes_medio: 25,
  minutes_grande: 30,
  minutes_bem_grande: 40,
  addon_minutes: 10,
  addon_minutes_passeio: 5,
  addon_minutes_medio: 8,
  addon_minutes_grande: 10,
  addon_minutes_bem_grande: 15,
  addon_price_passeio: 10,
  addon_price_medio: 12,
  addon_price_grande: 15,
  addon_price_bem_grande: 20,
  addon_price_app_passeio: 8,
  addon_price_app_medio: 10,
  addon_price_app_grande: 12,
  addon_price_app_bem_grande: 18,
  average_minutes: 30,
  short_description: null,
  kind: "main",
  is_active: true,
} as ServiceRecord;

describe("motor de preço por porte (vehicle-catalog)", () => {
  it("resolve preço 'particular' por tipo de veículo", () => {
    expect(resolveServicePriceByVehicleType(service, "hatch", {}, "particular")).toBe(40);
    expect(resolveServicePriceByVehicleType(service, "suv", {}, "particular")).toBe(60);
    expect(resolveServicePriceByVehicleType(service, "truck", {}, "particular")).toBe(80);
  });

  it("resolve preço 'app' (portal) por tipo de veículo", () => {
    expect(resolveServicePriceByVehicleType(service, "hatch", {}, "app")).toBe(35);
    expect(resolveServicePriceByVehicleType(service, "suv", {}, "app")).toBe(55);
  });

  it("aplica overrides de porte do tenant", () => {
    expect(resolveServicePriceByVehicleType(service, "suv", { suv: "medio" }, "app")).toBe(45);
  });

  it("resolve minutos por tipo de veículo", () => {
    expect(resolveServiceMinutesByVehicleType(service, "hatch", {})).toBe(20);
    expect(resolveServiceMinutesByVehicleType(service, "truck", {})).toBe(40);
  });
});
