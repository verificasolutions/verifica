"use client";

import { useEffect, useState } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function CommercialAddressFields({ inputClassName }: { inputClassName: string }) {
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    const digits = digitsOnly(postalCode);
    if (digits.length !== 8) return;

    let cancelled = false;
    setLoadingAddress(true);

    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((response) => response.json() as Promise<ViaCepResponse>)
      .then((data) => {
        if (cancelled || data?.erro) return;
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setStateCode(data.uf ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAddress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postalCode]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <input
          name="postal_code"
          value={postalCode}
          onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
          placeholder="CEP"
          className={inputClassName}
          required
        />
        <input name="street_number" placeholder="Número" className={inputClassName} required />
        <input name="complement" placeholder="Complemento" className={inputClassName} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.5fr_0.8fr]">
        <input
          name="street"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          placeholder={loadingAddress ? "Endereço • buscando CEP" : "Endereço"}
          className={inputClassName}
          required
        />
        <input
          name="neighborhood"
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          placeholder="Bairro"
          className={inputClassName}
          required
        />
        <div className="grid gap-4 md:grid-cols-[1fr_0.34fr]">
          <input name="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" className={inputClassName} required />
          <input
            name="state"
            value={stateCode}
            onChange={(event) => setStateCode(event.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            className={inputClassName}
            required
          />
        </div>
      </div>
    </div>
  );
}
