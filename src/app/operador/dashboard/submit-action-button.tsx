"use client";

import { useFormStatus } from "react-dom";

type SubmitActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
};

export function SubmitActionButton({
  idleLabel,
  pendingLabel,
  className,
}: SubmitActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending} className={`${className} transition-opacity disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
