"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { FormPendingContext } from "@/components/form-pending-context";

export function AuthSubmitButton({
  label,
  pendingLabel,
  className,
  ...props
}: {
  label: string;
  pendingLabel: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const pendingOverride = useContext(FormPendingContext);
  const isPending = pendingOverride ?? pending;

  return (
    <button
      type="submit"
      disabled={isPending}
      className={className}
      {...props}
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
