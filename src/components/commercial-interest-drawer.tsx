"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { submitCommercialIntakeAction, type CommercialIntakeFormState } from "@/app/quero/actions";
import { CommercialAddressFields } from "@/components/commercial-address-fields";
import { DocumentInput, PhoneInput } from "@/components/masked-inputs";
import type { CommercialPlanDefinition } from "@/backend/shared/commercial-offers";

const inputClassName =
  "h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/34";

const initialState: CommercialIntakeFormState = {};

export function CommercialInterestDrawer({ plans }: { plans: CommercialPlanDefinition[] }) {
  const router = useRouter();
  const [openPlanCode, setOpenPlanCode] = useState<string | null>(null);
  const activePlan = plans.find((item) => item.code === openPlanCode) ?? null;
  const [state, formAction, pending] = useActionState(submitCommercialIntakeAction, initialState);

  useEffect(() => {
    if (state.paymentPath) {
      router.push(state.paymentPath);
    }
  }, [router, state.paymentPath]);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.code} className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">{plan.code === "implementation" ? "Principal" : plan.code === "custom_saas" ? "Sob medida" : "Entrada"}</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-3 text-sm leading-6 text-white/62">{plan.summary}</p>
            <p className="mt-5 text-lg font-semibold text-white">{plan.priceLabel}</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-white/72">
              {plan.highlights.map((item) => (
                <li key={item} className="rounded-2xl border border-white/10 bg-black/16 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
            {plan.recurringIncludes?.length ? (
              <div className="mt-5 rounded-[24px] border border-[var(--accent)]/18 bg-[var(--accent)]/8 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">Mensal inclui</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/70">
                  {plan.recurringIncludes.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setOpenPlanCode(plan.code)}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_42px_rgba(0,245,212,0.16)]"
            >
              Adquirir
            </button>
          </article>
        ))}
      </div>

      {activePlan ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" aria-label="Fechar cadastro" onClick={() => setOpenPlanCode(null)} />

          <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0d1117] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Cadastro comercial</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">{activePlan.name}</h2>
                <p className="mt-2 text-sm leading-6 text-white/62">{activePlan.priceLabel}</p>
              </div>
              <button type="button" onClick={() => setOpenPlanCode(null)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/72">
                Fechar
              </button>
            </div>

            <div className="mt-6 rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm leading-7 text-white/72">{activePlan.summary}</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                {activePlan.highlights.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-black/16 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <form action={formAction} className="mt-6 space-y-4">
              <input type="hidden" name="selected_plan_code" value={activePlan.code} />

              <div className="grid gap-4 md:grid-cols-2">
                <input name="full_name" placeholder="Nome completo do responsável" className={inputClassName} required />
                <input name="email" type="email" placeholder="E-mail principal" className={inputClassName} required />
                <PhoneInput name="whatsapp" placeholder="WhatsApp" className={inputClassName} />
                <PhoneInput name="contact_phone" placeholder="Outro telefone" className={inputClassName} />
                <DocumentInput name="document" placeholder="CPF ou CNPJ" className={inputClassName} />
                <input name="legal_name" placeholder="Razão social ou nome completo legal" className={inputClassName} />
                <input name="trade_name" placeholder="Nome fantasia" className={inputClassName} />
                <input name="state_registration" placeholder="Inscrição estadual" className={inputClassName} />
                <input name="municipal_registration" placeholder="Inscrição municipal" className={inputClassName} />
              </div>

              <CommercialAddressFields inputClassName={inputClassName} />

              <textarea
                name="current_situation"
                rows={4}
                placeholder="Descreva rapidamente sua situação atual, o que precisa resolver e o que espera do sistema."
                className="w-full rounded-[24px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none placeholder:text-white/34"
              />

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Contrato comercial</p>
                    <p className="mt-1 text-sm text-white/58">Leia o contrato antes de continuar para o pagamento.</p>
                  </div>
                  <Link href={`/quero/contrato?plan=${activePlan.code}`} target="_blank" className="text-sm font-semibold text-[var(--accent)]">
                    Abrir contrato
                  </Link>
                </div>

                <label className="mt-4 flex items-start gap-3 text-sm text-white/72">
                  <input type="checkbox" name="accepted_contract" value="true" className="mt-1 size-4" required />
                  <span>Li e entendi o contrato deste plano e autorizo o uso dos meus dados para implantação, contato comercial, cobrança e suporte.</span>
                </label>
              </div>

              {state.error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{state.error}</p> : null}

              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {pending ? "Salvando cadastro..." : "Salvar cadastro"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
