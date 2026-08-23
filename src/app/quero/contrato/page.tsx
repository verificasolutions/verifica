import Link from "next/link";
import { buildCommercialContract, findCommercialPlan } from "@/backend/shared/commercial-offers";

export default async function CommercialContractPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const selectedPlan = findCommercialPlan(plan ?? "");
  const contract = buildCommercialContract(selectedPlan);

  return (
    <main className="min-h-screen bg-[#071016] px-5 py-10 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/quero" className="text-sm font-semibold text-white/70">
          Voltar para planos
        </Link>

        <section className="mt-6 rounded-[34px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Contrato comercial</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{contract.title}</h1>
          <p className="mt-3 text-sm text-white/50">Versão {contract.version}</p>

          <div className="mt-8 space-y-4 text-sm leading-7 text-white/72">
            {contract.body.split("\n\n").map((block) => (
              <div key={block} className="rounded-[24px] border border-white/10 bg-black/16 px-5 py-4">
                {block.split("\n").map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
