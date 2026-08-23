"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
  label,
  pendingLabel,
  className,
  confirmMessage,
}: {
  label: string;
  pendingLabel?: string;
  className: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (pending || !confirmMessage) return;
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel ?? label : label}
    </button>
  );
}
