import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { FloatingCtaButton } from "@/components/floating-cta-button";
import { HeroVideoPanel } from "@/components/hero-video-panel";
import { SaasEcosystemShowcase } from "@/components/saas-ecosystem-showcase";
import { TenantPublicSite, buildTenantPublicMetadata, getTenantPublicSite } from "@/components/tenant-public-site";
import { resolveTenantSlugFromHost } from "@/backend/shared/tenant-public-host";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const hostSlug = resolveTenantSlugFromHost(host);

  if (!hostSlug || !host) {
    return {
      title: "Verifica | Operação, automação e presença digital para negócios locais",
      description:
        "O Verifica centraliza operação, WhatsApp, caixa, estoque, clientes, site próprio, Instagram e presença local para pequenos negócios venderem mais todos os dias.",
      openGraph: {
        title: "Verifica | Operação, automação e presença digital",
        description:
          "Receba clientes, acompanhe serviços, automatize mensagens, publique conteúdo, tenha site próprio e organize sua operação em um único sistema.",
        siteName: "Verifica Solutions",
        locale: "pt_BR",
        type: "website",
        images: [{ url: "/verifica/verifica-logo.png" }],
      },
    };
  }

  return (await buildTenantPublicMetadata(hostSlug, `https://${host.replace(/:\d+$/, "")}`)) ?? {};
}

const ecosystemItems = [
  { label: "WhatsApp", imageSrc: "/verifica/saas/whatsapp.png" },
  { label: "Instagram" },
  { label: "Site próprio", imageSrc: "/verifica/saas/site-proprio.jpg" },
  { label: "Google Maps", imageSrc: "/verifica/saas/maps.jpg" },
  { label: "Caixa", imageSrc: "/verifica/saas/caixa.jpg" },
  { label: "Estoque", imageSrc: "/verifica/saas/estoque.jpg" },
  { label: "Clientes", imageSrc: "/verifica/saas/clientes.jpg" },
  { label: "Agenda", imageSrc: "/verifica/saas/agenda.jpg" },
  { label: "Operação", imageSrc: "/verifica/saas/operacao.jpg" },
];

const pains = [
  "Cliente esquece de voltar",
  "WhatsApp vira bagunça",
  "Instagram fica abandonado",
  "Não aparece no Google",
  "Não sabe quanto ganhou no dia",
  "Equipe perde tempo perguntando andamento",
];

const flowSteps = [
  { title: "Cliente entra", note: "WhatsApp, site ou atendimento presencial" },
  { title: "Atendimento criado", note: "Tudo registrado no fluxo operacional" },
  { title: "Equipe executa", note: "Box, etapa e responsável organizados" },
  { title: "Fotos registradas", note: "Prova visual real do serviço" },
  { title: "Cliente recebe atualização", note: "Mensagem automática no momento certo" },
  { title: "Serviço finalizado", note: "Operação fechada com histórico salvo" },
  { title: "Post criado automaticamente", note: "Conteúdo nasce da execução real" },
  { title: "Avaliação solicitada", note: "Pós-venda ativado sem retrabalho" },
  { title: "Cliente retorna", note: "Ciclo de retenção e nova venda" },
];

const niches = [
  "Estética automotiva",
  "Pet shop",
  "Oficina mecânica",
  "Assistência técnica",
  "Manutenção residencial",
  "Marcenaria",
  "Comunicação visual",
  "Limpeza profissional",
];

function MediaPlaceholder({
  label,
  title,
  tall = false,
  imageSrc,
}: {
  label: string;
  title: string;
  tall?: boolean;
  imageSrc?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[30px] bg-[#0f1720] shadow-[0_24px_80px_rgba(0,0,0,0.32)] ${
        imageSrc ? "border border-black/28" : "border border-white/10"
      } ${tall ? "min-h-[420px]" : "min-h-[300px]"}`}
    >
      {imageSrc ? (
        <img src={imageSrc} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,245,212,0.18),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.12),transparent_30%)]" />
      )}
      {imageSrc ? null : (
        <div className="relative flex h-full min-h-inherit flex-col justify-between p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/56">{label}</span>
            <span className="size-3 rounded-full bg-[var(--accent)] shadow-[0_0_24px_rgba(0,245,212,0.65)]" />
          </div>
          <div className="mt-16 rounded-[24px] border border-white/10 bg-black/28 p-5">
            <p className="text-lg font-semibold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-white/56">Espaço preparado para print de tela ou vídeo real do SaaS.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductLanding() {
  return (
    <main id="topo" className="min-h-screen overflow-hidden bg-[#071016] text-white">
      <section className="relative min-h-screen border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,245,212,0.23),transparent_28%),radial-gradient(circle_at_78%_12%,rgba(96,165,250,0.16),transparent_30%),linear-gradient(180deg,#071016,#0b1118_58%,#071016)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.42))]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white p-1">
                <img src="/verifica/verifica-logo.png" alt="Verifica" className="h-full w-full object-contain" />
              </span>
              <span>
                <span className="block text-lg font-semibold leading-none text-white">Verifica</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-white/42">by Verifica Solutions</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-white/64 md:flex">
              <a href="#ecossistema" className="hover:text-white">Ecossistema</a>
              <a href="#marketing" className="hover:text-white">Marketing</a>
              <a href="#site" className="hover:text-white">Site próprio</a>
              <a href="#nichos" className="hover:text-white">Nichos</a>
            </nav>
          </header>

          <div className="grid flex-1 items-stretch gap-8 py-14 lg:grid-cols-[0.46fr_1.54fr] lg:gap-8">
            <div className="max-w-[18.5rem] lg:flex lg:min-h-full lg:flex-col lg:justify-between lg:pt-6">
              <div className="inline-flex rounded-full border border-[var(--accent)]/24 bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                SaaS para negócios locais
              </div>
              <div className="mt-6 h-px w-64 max-w-full bg-[linear-gradient(90deg,rgba(0,245,212,0.48),rgba(0,245,212,0.08))]" />
              <h1 className="mt-10 max-w-[17.5rem] text-[2.15rem] font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-[2.6rem] xl:text-[3rem] lg:mt-0 lg:flex lg:flex-1 lg:items-center">
                Automatize a operação, organize os fluxos de trabalho e fortaleça sua presença digital.
              </h1>
            </div>

            <HeroVideoPanel />
          </div>
          <p className="mx-auto mt-2 max-w-6xl text-center text-base leading-8 text-white/68 xl:text-[1.02rem]">
            Centralize atendimento, execução, mensagens, site público, Instagram e presença na internet em um único sistema.
          </p>
          <div className="mt-8 flex justify-center">
            <a href="mailto:contato@verificasolutions.com.br?subject=Quero uma demonstração do Verifica" className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 shadow-[0_18px_42px_rgba(0,245,212,0.24)]">
              Solicitar demonstração
            </a>
          </div>
        </div>
      </section>
      <FloatingCtaButton />

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">O problema real</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">O negócio perde dinheiro no detalhe.</h2>
          <p className="mt-4 text-base leading-8 text-white/62">
            A maioria dos negócios locais não perde cliente por falta de serviço. Perde por falta de processo, presença e retorno.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {pains.map((pain) => (
            <div key={pain} className="rounded-[24px] border border-rose-400/12 bg-rose-400/7 p-4 text-sm font-semibold text-white/82">
              <span className="mr-2 text-rose-300">×</span>{pain}
            </div>
          ))}
          <div className="rounded-[24px] border border-[var(--accent)]/24 bg-[var(--accent)]/10 p-4 text-sm font-semibold text-white sm:col-span-2">
            O Verifica resolve operação, comunicação, marketing e retorno em um único fluxo.
          </div>
        </div>
      </section>

      <section id="ecossistema" className="border-y border-white/10 bg-white/[0.03] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <a
              href="#topo"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-5 text-sm font-semibold text-white/84 transition hover:bg-white/12"
            >
              Voltar ao topo
            </a>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Ecossistema</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Não é apenas um sistema. É o hub do negócio.</h2>
          </div>
          <SaasEcosystemShowcase items={ecosystemItems} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Depois que o serviço fecha</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">O atendimento vira operação, comunicação, conteúdo e retorno.</h2>
            <p className="mt-4 text-base leading-8 text-white/62">
              O Verifica acompanha a jornada completa: do primeiro atendimento até a próxima venda.
            </p>
          </div>
          <div className="relative rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 sm:p-6">
            <div className="absolute bottom-10 left-1/2 top-10 hidden w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(0,245,212,0.06),rgba(0,245,212,0.55),rgba(0,245,212,0.06))] lg:block" />
            <div className="grid gap-4">
              {flowSteps.map((step, index) => {
                const alignRight = index % 2 === 1;

                return (
                  <div key={step.title} className={`flex ${alignRight ? "lg:justify-end" : "lg:justify-start"}`}>
                    <div className="relative w-full lg:w-[calc(50%-24px)]">
                      <div className="absolute left-1/2 top-1/2 hidden size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)] shadow-[0_0_28px_rgba(0,245,212,0.4)] lg:block" />
                      <div className="relative rounded-[28px] border border-white/10 bg-[#141c24] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.18)] transition hover:border-[var(--accent)]/30 hover:bg-[#16202a]">
                        <div className="flex items-start gap-4">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-slate-950">{index + 1}</span>
                          <div>
                            <p className="text-base font-semibold text-white">{step.title}</p>
                            <p className="mt-2 text-sm leading-6 text-white/58">{step.note}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 lg:pt-4">
                <div className="mx-auto flex w-full max-w-[260px] items-center justify-center rounded-[28px] border border-[var(--accent)]/28 bg-[var(--accent)]/10 px-5 py-4 text-center shadow-[0_0_38px_rgba(0,245,212,0.12)]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Resultado</p>
                    <p className="mt-2 text-lg font-semibold text-white">Cliente retorna e o ciclo recomeça.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="marketing" className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Marketing automático</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Seu trabalho vira conteúdo automaticamente.</h2>
          <p className="mt-4 text-base leading-8 text-white/62">
            Você já está produzindo conteúdo todos os dias. O Verifica transforma fotos reais da operação em peças para aprovar e publicar.
          </p>
          <div className="mt-8 grid gap-3">
            {["Antes e depois", "Sistema cria postagem", "Você aprova", "Publica no Instagram"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/78">{item}</div>
            ))}
          </div>
        </div>
        <MediaPlaceholder label="Motor social" title="Demonstração do motor social criando posts reais" tall imageSrc="/verifica/saas/motor-social.jpg" />
      </section>

      <section id="site" className="border-y border-white/10 bg-white/[0.03] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-[30px] border border-black/28 bg-[#0f1720] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <img src="/verifica/saas/landing-cliente.jpg" alt="Landing page individual do cliente" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Site próprio</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Cada cliente ganha seu próprio site profissional.</h2>
            <p className="mt-4 text-base leading-8 text-white/62">
              Perfil, capa, serviços, avaliações, galeria, posts aprovados, WhatsApp e mapa. Sem depender de agência para começar.
            </p>
            <div className="mt-7 rounded-[26px] border border-white/10 bg-[#111922] p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-white/42">Exemplo</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--accent)]">verificasolutions.com.br/nome-do-cliente</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Google e presença local</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Seja encontrado quando alguém procurar seus serviços.</h2>
          <p className="mt-4 text-base leading-8 text-white/62">
            Nos planos avançados, o Verifica ajuda a estruturar presença local para buscas como lava rápido perto de mim, pet shop, oficina mecânica e outros serviços da região.
          </p>
        </div>
        <div className="rounded-[32px] border border-white/10 bg-[#111922] p-5">
          <div className="rounded-[24px] bg-white p-5 text-slate-950">
            <div className="rounded-full border border-slate-200 px-5 py-3 text-sm text-slate-500">serviço perto de mim</div>
            <div className="mt-5 space-y-3">
              {["Seu negócio no mapa", "WhatsApp direto", "Avaliações e fotos", "Página profissional"].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 p-4 font-semibold">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="nichos" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Nichos atendidos</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Feito para negócios locais que prestam serviço e precisam de processo.</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {niches.map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-white/6 p-5 text-lg font-semibold text-white">{item}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="rounded-[38px] border border-[var(--accent)]/22 bg-[linear-gradient(135deg,rgba(0,245,212,0.14),rgba(17,25,34,0.94))] p-7 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">O grande diferencial</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Você não compra apenas um sistema.</h2>
              <p className="mt-4 text-base leading-8 text-white/66">
                Você ganha gestão operacional, WhatsApp automatizado, marketing, site próprio, presença local, histórico, avaliações e fidelização.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Gestão operacional", "WhatsApp automatizado", "Marketing para Instagram", "Site próprio", "Presença no Google", "Área do cliente", "Histórico completo", "Fidelização"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm font-semibold text-white/84">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10">
        <div className="rounded-[32px] border border-white/10 bg-[#111922] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-white/42">Separado</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">Quanto custa manter tudo isso separado?</h3>
          <div className="mt-6 space-y-3 text-sm text-white/68">
            {["Sistema de gestão", "Ferramenta de WhatsApp", "Agência de marketing", "Site profissional", "Landing page", "Ferramenta de postagens", "Gestão de clientes"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/18 px-4 py-3">
                <span>{item}</span>
                <span className="text-rose-200">mais custo</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-[32px] border border-[var(--accent)]/22 bg-[var(--accent)]/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">Com Verifica</p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Tudo centralizado em uma única operação.</h3>
          <p className="mt-4 text-base leading-8 text-white/68">
            Menos ferramentas, menos retrabalho e mais clareza para vender todos os dias.
          </p>
          <a href="mailto:contato@verificasolutions.com.br?subject=Quero conhecer o Verifica" className="mt-8 inline-flex min-h-13 w-fit items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950">
            Solicitar demonstração
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl text-xl font-semibold text-white">
            O sistema que ajuda pequenos negócios locais a operar melhor, aparecer mais e vender todos os dias.
          </p>
          <div className="space-y-1 text-sm text-white/60 md:text-right">
            <p className="text-white/82">Verifica Solutions</p>
            <p>
              E-mail:{" "}
              <a href="mailto:contato@verificasolutions.com.br" className="text-[var(--accent)] transition hover:text-white">
                contato@verificasolutions.com.br
              </a>
            </p>
            <p>
              Telefone:{" "}
              <a href="tel:+5511947550027" className="text-[var(--accent)] transition hover:text-white">
                (11) 94755-0027
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default async function Home() {
  const host = (await headers()).get("host");
  const hostSlug = resolveTenantSlugFromHost(host);

  if (hostSlug) {
    const publicSite = await getTenantPublicSite(hostSlug);
    if (publicSite?.tenantSettings?.landing_enabled && (!publicSite.landing || publicSite.landing.is_published)) {
      return <TenantPublicSite slug={hostSlug} origin={`https://${host?.replace(/:\d+$/, "")}`} />;
    }
  }

  const context = await resolveAccessContext();

  if (context.kind === "platform_admin") {
    redirect("/admin");
  }

  if (context.kind === "tenant_user") {
    redirect(context.role === "operator" ? "/operador/dashboard" : "/app/dashboard");
  }

  return <ProductLanding />;
}
