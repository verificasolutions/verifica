"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

export function DeliveryChoiceSubmitButton({
  label,
  pendingLabel,
  className,
  confirmMessage,
  hiddenInputName = "mark_delivered",
}: {
  label: string;
  pendingLabel?: string;
  className: string;
  confirmMessage: string;
  hiddenInputName?: string;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <input type="hidden" name={hiddenInputName} value="false" />
      <button
        ref={buttonRef}
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (pending) return;
          const form = buttonRef.current?.form;
          if (!form) return;
          const hiddenField = form.elements.namedItem(hiddenInputName);
          if (!(hiddenField instanceof HTMLInputElement)) return;
          hiddenField.value = window.confirm(confirmMessage) ? "true" : "false";
          form.requestSubmit();
        }}
      >
        {pending ? pendingLabel ?? label : label}
      </button>
    </>
  );
}
