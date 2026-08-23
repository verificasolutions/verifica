import { redirect } from "next/navigation";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { FlashNotice } from "@/components/flash-notice";
import { PasswordInput } from "@/components/password-input";
import { forgotPasswordAction, signInAction, signUpAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const context = await resolveAccessContext();
  const { error, message } = await searchParams;

  if (context.kind === "platform_admin") {
    redirect("/admin");
  }

  if (context.kind === "tenant_user") {
    redirect(context.role === "operator" ? "/operador/dashboard" : "/app/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white/6 p-0 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.22),_transparent_55%),linear-gradient(135deg,_rgba(56,189,248,0.08),_rgba(13,17,23,0.96))] p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-white/48">Verifica</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Acesso ao sistema</h1>
          <p className="mt-2 text-sm text-white/60">Gestão operacional e presença digital</p>
        </div>

        <div className="space-y-4 p-5">
          <FlashNotice error={error} message={message} />

          <form className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/78">E-mail</span>
              <input
                name="email"
                type="email"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
                placeholder="seu@email.com"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/78">Senha</span>
              <PasswordInput
                name="password"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]"
                placeholder="********"
              />
            </label>
            <div className="grid gap-2">
              <AuthSubmitButton
                label="Entrar"
                pendingLabel="Entrando..."
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)] transition active:scale-[0.98]"
                formAction={signInAction as never}
              />
              <button
                formAction={signUpAction}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82 transition active:scale-[0.98]"
              >
                Criar conta
              </button>
              <AuthSubmitButton
                label="Esqueci minha senha"
                pendingLabel="Enviando link..."
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82 transition active:scale-[0.98]"
                formAction={forgotPasswordAction as never}
              />
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
