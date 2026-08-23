"use client";

import { useId, useMemo, useState } from "react";

type VehicleTypeOption = {
  code: string;
  label: string;
};

type VehicleModelOption = {
  brand: string;
  name: string;
};

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function normalizeAutocompleteChoice(value: string, options: readonly string[]) {
  const raw = value.trim();
  if (!raw) return "";

  const exact = options.find((item) => item.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const startsWith = options.filter((item) => item.toLowerCase().startsWith(raw.toLowerCase()));
  if (startsWith.length === 1) return startsWith[0];

  return raw;
}

export function VehicleIdentityFields({
  platePlaceholder = "ABC1D23",
  defaultBrand = "",
  defaultModel = "",
  defaultColor = "",
  brandOptions,
  modelOptions,
  colorOptions,
  vehicleTypeOptions,
  valueVehicleType = "",
  onVehicleTypeChange,
}: {
  platePlaceholder?: string;
  defaultBrand?: string;
  defaultModel?: string;
  defaultColor?: string;
  brandOptions: string[];
  modelOptions: VehicleModelOption[];
  colorOptions: string[];
  vehicleTypeOptions: VehicleTypeOption[];
  valueVehicleType?: string;
  onVehicleTypeChange?: (value: string) => void;
}) {
  const [brand, setBrand] = useState(defaultBrand);
  const [model, setModel] = useState(defaultModel);
  const [color, setColor] = useState(defaultColor);
  const [internalVehicleType, setInternalVehicleType] = useState(valueVehicleType);

  const brandListId = useId();
  const modelListId = useId();
  const colorListId = useId();

  const availableModels = useMemo(() => {
    if (!brand.trim()) return modelOptions.map((item) => item.name);

    const normalizedBrand = brand.trim().toLowerCase();
    return modelOptions.filter((item) => item.brand.toLowerCase() === normalizedBrand).map((item) => item.name);
  }, [brand, modelOptions]);

  const resolvedVehicleType = onVehicleTypeChange ? valueVehicleType : internalVehicleType;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <input
          name="plate"
          required
          placeholder={platePlaceholder}
          onChange={(event) => {
            event.currentTarget.value = normalizePlate(event.currentTarget.value);
          }}
          className="h-12 w-full rounded-2xl border border-white/15 bg-gradient-to-r from-slate-100 to-white px-4 text-center font-mono text-base tracking-[0.25em] text-slate-900 uppercase outline-none"
        />
        <select
          name="vehicle_type"
          required
          value={resolvedVehicleType}
          onChange={(event) => {
            if (onVehicleTypeChange) {
              onVehicleTypeChange(event.target.value);
              return;
            }

            setInternalVehicleType(event.target.value);
          }}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
        >
          <option value="" disabled>
            Tipo do veículo
          </option>
          {vehicleTypeOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <input
            list={brandListId}
            name="vehicle_brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            onBlur={() => setBrand((current) => normalizeAutocompleteChoice(current, brandOptions))}
            placeholder="Marca"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <datalist id={brandListId}>
            {brandOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div>
          <input
            list={modelListId}
            name="vehicle_model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            onBlur={() => setModel((current) => normalizeAutocompleteChoice(current, availableModels))}
            placeholder="Modelo"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <datalist id={modelListId}>
            {availableModels.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <input
          list={colorListId}
          name="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          onBlur={() => setColor((current) => normalizeAutocompleteChoice(current, colorOptions))}
          placeholder="Cor"
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
        />
        <datalist id={colorListId}>
          {colorOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
