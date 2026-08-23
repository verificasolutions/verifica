import Link from "next/link";
import { notFound } from "next/navigation";
import { findCommercialIntakeById } from "@/backend/repos/commercial-intakes-repo";

function formatCurrency(value: number | null) {
  if (value === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function CommercialPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intake = await findCommercialIntakeById(id);

  if (!intake) {
    notFound();
  }

  const paymentBaseUrl = process.env.NEXT_PUBLIC_COMMERCIAL_PAYMENT_URL || process.env.COMMERCIAL_PAYMENT_URL || "";
  const paymentUrl = paymentBaseUrl
    ? `${paymentBaseUrl}${paymentBaseUrl.includes("?") ? "&" : "?"}lead=${encodeURIComponent(intake.id)}&plan=${encodeURIComponent(intake.selected_plan_code)}`
    : "";

  return (
    <main className="min-h-screen bg-[#071016] px-5 py-10 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/quero" className="text-sm font-semibold text-white/70">
          Voltar para planos
        </Link>

        <section className="mt-6 rounded-[34px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Pagamento</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Cadastro salvo com sucesso.</h1>
          <p className="mt-3 text-base leading-7 text-white/64">
            Revise seu plano, leia o contrato novamente se quiser e siga para o pagamento assim que o link final estiver configurado.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/42">Plano</p>
              <p className="mt-2 text-lg font-semibold text-white">{intake.selected_plan_name}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/42">Implantação</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(intake.implementation_fee)}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/42">Mensal</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(intake.recurring_fee)}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link href={`/quero/contrato?plan=${intake.selected_plan_code}`} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 px-5 text-sm font-semibold text-white/82">
              Ler contrato novamente
            </Link>
            {paymentUrl ? (
              <a href={paymentUrl} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950">
                Pagar
              </a>
            ) : (
              <button type="button" disabled className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)]/55 px-5 text-sm font-semibold text-slate-950">
                Pagar
              </button>
            )}
          </div>

          {!paymentUrl ? (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
              O link final do pagamento ainda não foi configurado. Assim que você me passar a URL definitiva, eu conecto esse botão direto ao checkout.
            </p>
          ) : null}

          <div className="mt-8 rounded-[24px] border border-white/10 bg-black/16 p-4 text-sm leading-7 text-white/68">
            <p>Contato comercial: contato@verificasolutions.com.br</p>
            <p>WhatsApp: (11) 94755-0027</p>
            <p>CNPJ: 57.286.875/0001-19</p>
          </div>
        </section>
      </div>
    </main>
  );
}
