import Link from "next/link";
import { adminSignOutAction } from "@/app/admin/actions";

export type AdminSection =
  | "dashboard"
  | "tenants"
  | "comercial"
  | "financeiro"
  | "suporte"
  | "configuracoes"
  | "logs"
  | "radar";

export const adminSections: Array<{
  id: AdminSection;
  title: string;
  description: string;
}> = [
  { id: "dashboard", title: "Dashboard", description: "Visão geral da operação" },
  { id: "tenants", title: "Tenants", description: "Cadastro e gestão dos clientes" },
  { id: "comercial", title: "Comercial", description: "Cadastros, pagamentos e ativações" },
  { id: "financeiro", title: "Financeiro", description: "Receita, MRR e churn" },
  { id: "suporte", title: "Suporte", description: "Tickets e acompanhamento" },
  { id: "configuracoes", title: "Configurações", description: "Parâmetros globais do SaaS" },
  { id: "radar", title: "Caçar Clientes", description: "Prospecção e oportunidade comercial" },
  { id: "logs", title: "Logs", description: "Auditoria completa" },
];

function hrefFor(section: AdminSection) {
  return `/admin?section=${section}`;
}

export function AdminShell({
  currentSection = "tenants",
  adminEmail,
  children,
}: {
  currentSection?: AdminSection;
  adminEmail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.16),_transparent_58%),rgba(22,27,34,0.96)] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.32)]">
            <p className="text-xs uppercase tracking-[0.26em] text-white/45">Admin Master</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Verifica Control</h1>
            <p className="mt-2 text-sm text-white/58">{adminEmail ?? "-"}</p>
            <form action={adminSignOutAction} className="mt-4">
              <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white/80">
                Sair
              </button>
            </form>
          </section>

          <section className="grid gap-3">
            {adminSections.map((item) => {
              const active = currentSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={hrefFor(item.id)}
                  className={`rounded-[24px] border p-4 transition ${
                    active
                      ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.14),rgba(56,189,248,0.08))] shadow-[0_12px_36px_rgba(0,245,212,0.16)]"
                      : "border-white/10 bg-white/6"
                  }`}
                >
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/56">{item.description}</p>
                </Link>
              );
            })}
          </section>
        </aside>

        <section className="space-y-4">{children}</section>
      </div>
    </main>
  );
}
