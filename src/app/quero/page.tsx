import Link from "next/link";
import { commercialOfferHighlights, commercialPlans } from "@/backend/shared/commercial-offers";
import { CommercialInterestDrawer } from "@/components/commercial-interest-drawer";
import { HeroVideoPanel } from "@/components/hero-video-panel";

export default function QueroPage() {
  return (
    <main className="min-h-screen bg-[#071016] text-white">
      <section className="border-b border-white/10 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-sm font-semibold text-white/72">
              Voltar para a landing
            </Link>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Jornada comercial</p>
          </div>

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Eu quero o Verifica</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Implantação, operação digital e evolução real do seu negócio local.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/66">
                Aqui você entende exatamente o que entregamos, quais são os planos, como funciona a implantação e quais dados precisamos para iniciar a sua operação.
              </p>
            </div>

            <HeroVideoPanel />
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">O que oferecemos</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Tudo o que colocamos de pé para a sua empresa operar melhor e existir com força na vida online.</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {commercialOfferHighlights.map((item) => (
              <div key={item} className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm font-semibold leading-6 text-white/80">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Planos</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Escolha a forma de começar.</h2>
            <p className="mt-4 text-base leading-8 text-white/64">
              Você pode entrar pela implantação completa, começar no básico ou pedir uma solução sob medida.
            </p>
          </div>

          <div className="mt-10">
            <CommercialInterestDrawer plans={commercialPlans} />
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Como funciona</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Você preenche, revisa o contrato e segue para o pagamento.</h2>
            <div className="mt-8 grid gap-3">
              {[
                "Escolha o plano que faz sentido para a sua operação.",
                "Preencha o cadastro completo com CPF ou CNPJ, endereço e dados de contato.",
                "Leia o contrato do plano, aceite os termos e salve.",
                "Na sequência você segue para a página de pagamento.",
                "Depois da confirmação do pagamento, o contrato segue para o seu e-mail.",
              ].map((item, index) => (
                <div key={item} className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-white/76">
                  <span className="mr-3 inline-flex size-7 items-center justify-center rounded-full bg-[var(--accent)] font-semibold text-slate-950">
                    {index + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Contato direto</p>
            <div className="mt-5 space-y-4 text-sm text-white/72">
              <p>Razão Social: 57.286.875 ANTONIA AMANDA RODRIGUES DA SILVA</p>
              <p>CNPJ: 57.286.875/0001-19</p>
              <p>E-mail: contato@verificasolutions.com.br</p>
              <p>Telefone: (11) 94755-0027</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
