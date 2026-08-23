import { redirect } from "next/navigation";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { FlashNotice } from "@/components/flash-notice";
import { PhoneInput } from "@/components/masked-inputs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeSetupAction } from "./actions";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const context = await resolveAccessContext();
  const { error } = await searchParams;

  if (!user) {
    redirect("/login");
  }

  if (context.kind === "platform_admin") {
    redirect("/admin");
  }

  if (context.kind === "tenant_user") {
    redirect(context.role === "operator" ? "/operador/dashboard" : "/app/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-[22px] border border-white/10 bg-white/6 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Primeiro acesso</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Ativar seu lava-rapido</h1>
        <p className="mt-2 text-sm text-white/60">Cria o dono inicial e o tenant principal do sistema.</p>

        <div className="mt-4">
          <FlashNotice error={error} />
        </div>

        <form action={completeSetupAction} className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-white/78">Seu nome</span>
            <input
              name="full_name"
              defaultValue={(user.user_metadata.full_name as string | undefined) ?? ""}
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
              placeholder="Joao Silva"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-white/78">Nome do lava-rapido</span>
            <input
              name="wash_name"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
              placeholder="Nome da empresa"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-white/78">Link personalizado</span>
            <input
              name="custom_slug"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
              placeholder="central-wash"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-white/78">WhatsApp</span>
            <PhoneInput
              name="whatsapp"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
              placeholder="(11) 99999-9999"
            />
          </label>

          <AuthSubmitButton
            label="Criar ambiente"
            pendingLabel="Criando..."
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)] transition active:scale-[0.98]"
          />
        </form>
      </section>
    </main>
  );
}
