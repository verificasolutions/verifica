"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
    >
      {copied ? "Copiado" : "Copiar mensagem"}
    </button>
  );
}
