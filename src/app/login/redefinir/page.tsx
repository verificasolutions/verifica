import Link from "next/link";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const context = await resolveAccessContext();

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
          <h1 className="mt-3 text-3xl font-semibold text-white">Redefinir senha</h1>
          <p className="mt-2 text-sm text-white/60">Defina uma nova senha para voltar ao sistema</p>
        </div>

        <div className="space-y-4 p-5">
          <ResetPasswordForm />
          <Link href="/login" className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82">
            Voltar ao login
          </Link>
        </div>
      </section>
    </main>
  );
}
