"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormPendingContext } from "@/components/form-pending-context";

type LandingPageActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_STATE: LandingPageActionState = {
  status: "idle",
  message: "",
};

type LandingPageFormProps = {
  children: React.ReactNode;
  className?: string;
  actionUrl: string;
};

export function LandingPageForm({ children, className, actionUrl }: LandingPageFormProps) {
  const router = useRouter();
  const [state, setState] = useState(INITIAL_STATE);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(INITIAL_STATE);

    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });

      const payload = (await response.json()) as { ok: boolean; message: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Falha ao salvar a landing.");
      }

      setState({
        status: "success",
        message: payload.message || "Landing salva.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao salvar a landing.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormPendingContext.Provider value={pending}>
      <form onSubmit={handleSubmit} className={className}>
        {state.status === "success" ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {state.message}
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {state.message}
          </div>
        ) : null}

        {children}
      </form>
    </FormPendingContext.Provider>
  );
}
