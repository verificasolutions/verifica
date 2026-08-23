"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type KnownInventoryItem = {
  name: string;
  barcode: string;
};

function setInputValue(inputId: string, value: string) {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;

  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function InventoryBarcodeScanner({ items }: { items: KnownInventoryItem[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [feedback, setFeedback] = useState("Aponte a câmera para o código de barras do produto.");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
  }

  useEffect(
    () => () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    },
    [],
  );

  async function startScanner() {
    if (!videoRef.current) return;

    stopScanner();
    setIsScanning(true);
    setTone("neutral");
    setFeedback("Câmera aberta. Centralize o código dentro da imagem.");

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 600,
      });

      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          if (!result) return;

          const barcode = result.getText().trim();
          const knownItem = items.find((item) => item.barcode === barcode);

          stopScanner();

          if (knownItem) {
            setInputValue("inventory-quick-barcode", barcode);
            setTone("success");
            setFeedback(`${knownItem.name} encontrado. Informe somente a quantidade da entrada.`);
            document.getElementById("inventory-quick-entry")?.scrollIntoView({ behavior: "smooth", block: "center" });
            window.setTimeout(() => document.getElementById("inventory-quick-quantity")?.focus(), 450);
            return;
          }

          setInputValue("inventory-new-barcode", barcode);
          setTone("neutral");
          setFeedback(`Código ${barcode} ainda não cadastrado. Complete os dados do novo item uma única vez.`);
          document.getElementById("inventory-new-item")?.scrollIntoView({ behavior: "smooth", block: "start" });
          window.setTimeout(() => document.getElementById("inventory-new-name")?.focus(), 450);
        },
      );
    } catch {
      stopScanner();
      setTone("error");
      setFeedback("Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.");
    }
  }

  const feedbackClass =
    tone === "success"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
        : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]";

  return (
    <div className="rounded-[24px] border border-[color:var(--surface-border)] bg-black/10 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-[color:var(--text-primary)]">Ler código pela câmera</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Produto conhecido abre a entrada rápida. Código novo abre o cadastro já preenchido.
          </p>
        </div>
        <button
          type="button"
          onClick={isScanning ? stopScanner : startScanner}
          className={`min-h-12 rounded-2xl px-5 text-sm font-semibold ${
            isScanning
              ? "border border-rose-400/25 bg-rose-400/10 text-rose-100"
              : "border border-transparent bg-[var(--accent)] text-slate-950"
          }`}
        >
          {isScanning ? "Fechar câmera" : "Abrir câmera"}
        </button>
      </div>

      {isScanning ? (
        <div className="relative mt-4 overflow-hidden rounded-[22px] border border-[var(--accent)] bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover sm:aspect-video" />
          <div className="pointer-events-none absolute inset-[18%_10%] rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
        </div>
      ) : (
        <video ref={videoRef} muted playsInline className="hidden" />
      )}

      <p aria-live="polite" className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedbackClass}`}>
        {feedback}
      </p>
    </div>
  );
}
