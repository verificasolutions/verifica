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

type EmployeeAddressFieldsProps = {
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  inputClassName: string;
};

export function EmployeeAddressFields(props: EmployeeAddressFieldsProps) {
  const [postalCode, setPostalCode] = useState(formatPostalCode(props.postalCode ?? ""));
  const [street, setStreet] = useState(props.street ?? "");
  const [neighborhood, setNeighborhood] = useState(props.neighborhood ?? "");
  const [city, setCity] = useState(props.city ?? "");
  const [stateCode, setStateCode] = useState(props.state ?? "");
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
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <input
          name="postal_code"
          value={postalCode}
          onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
          placeholder="CEP"
          className={props.inputClassName}
        />
        <input name="street_number" defaultValue={props.streetNumber ?? ""} placeholder="Número" className={props.inputClassName} />
        <input name="complement" defaultValue={props.complement ?? ""} placeholder="Complemento" className={props.inputClassName} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.5fr_0.8fr]">
        <input
          name="street"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          placeholder={loadingAddress ? "Endereço • buscando CEP" : "Endereço"}
          className={props.inputClassName}
        />
        <input
          name="neighborhood"
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          placeholder="Bairro"
          className={props.inputClassName}
        />
        <div className="grid gap-4 md:grid-cols-[1fr_0.3fr]">
          <input
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Cidade"
            className={props.inputClassName}
          />
          <input
            name="state"
            value={stateCode}
            onChange={(event) => setStateCode(event.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            className={props.inputClassName}
          />
        </div>
      </div>
    </>
  );
}
