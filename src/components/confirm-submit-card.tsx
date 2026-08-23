"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmSubmitCard({
  children,
  confirmMessage,
}: {
  children: ReactNode;
  confirmMessage: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (pending) return;
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="block w-full text-left"
    >
      {children}
    </button>
  );
}
