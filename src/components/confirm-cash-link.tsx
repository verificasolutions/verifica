"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ConfirmCashLink({
  href,
  message = "Abrir cobrança?",
  children,
}: {
  href: string;
  message?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(message)) {
          router.push(href);
        }
      }}
      className="block w-full text-left"
    >
      {children}
    </button>
  );
}
