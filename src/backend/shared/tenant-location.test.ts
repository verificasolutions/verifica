import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsLink, buildGoogleMapsEmbedUrl, buildTenantAddressLabel } from "./tenant-location";

describe("buildTenantAddressLabel (fonte única, com CEP)", () => {
  it("compõe endereço completo com complemento e CEP", () => {
    const label = buildTenantAddressLabel({
      street: "Rua das Flores",
      street_number: "123",
      complement: "Fundos",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      postal_code: "01001-000",
    });

    expect(label).toBe("Rua das Flores, 123, Fundos, Centro, São Paulo, SP, CEP 01001-000");
  });

  it("inclui CEP mesmo sem complemento", () => {
    const label = buildTenantAddressLabel({
      street: "Av. Paulista",
      street_number: "1000",
      city: "São Paulo",
      state: "SP",
      postal_code: "01310-100",
    });

    expect(label).toBe("Av. Paulista, 1000, São Paulo, SP, CEP 01310-100");
  });

  it("retorna null sem endereço e ignora CEP sem endereço", () => {
    expect(buildTenantAddressLabel({ postal_code: "01001-000" })).toBeNull();
    expect(buildTenantAddressLabel(null)).toBeNull();
    expect(buildTenantAddressLabel(undefined)).toBeNull();
  });

  it("gera URL do Google Maps a partir do endereço atual (regeneração)", () => {
    const label = buildTenantAddressLabel({ street: "Rua A", city: "Curitiba", state: "PR", postal_code: "80000-000" });
    const url = buildGoogleMapsEmbedUrl(label);
    expect(url).toContain("google.com/maps");
    expect(url).toContain(encodeURIComponent("Rua A"));
    expect(url).toContain(encodeURIComponent("80000-000"));
    expect(buildGoogleMapsEmbedUrl(null)).toBeNull();
  });

  it("usa a Embed API quando GOOGLE_MAPS_API_KEY é fornecida", () => {
    const label = "Rua A, Curitiba, PR, CEP 80000-000";
    const url = buildGoogleMapsEmbedUrl(label, "AIza-exemplo");
    expect(url).toContain("https://www.google.com/maps/embed/v1/place?key=AIza-exemplo");
    expect(url).toContain(encodeURIComponent(label));
    expect(buildGoogleMapsEmbedUrl(label, "")).not.toContain("embed/v1");
  });

  it("gera link funcional de abertura no Google Maps", () => {
    const label = "Rua A, Curitiba, PR, CEP 80000-000";
    expect(buildGoogleMapsDirectionsLink(label)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
    );
    expect(buildGoogleMapsDirectionsLink(null)).toBeNull();
    expect(buildGoogleMapsDirectionsLink("  ")).toBeNull();
  });
});
