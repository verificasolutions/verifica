"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PasswordInput } from "@/components/password-input";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "saving" | "done">("checking");
  const [message, setMessage] = useState("Validando seu link de recuperação...");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    let active = true;
    const ensureRecoverySession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (data.session) {
        setStatus("ready");
        setMessage("Defina sua nova senha.");
        return;
      }

      setStatus("invalid");
      setMessage("Esse link de recuperação está inválido ou expirou.");
    };

    ensureRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setStatus("ready");
        setMessage("Defina sua nova senha.");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      setStatus("ready");
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("ready");
      setMessage("A confirmação da senha não confere.");
      return;
    }

    setStatus("saving");
    setMessage("Salvando nova senha...");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("ready");
      setMessage(error.message);
      return;
    }

    setStatus("done");
    setMessage("Senha redefinida. Redirecionando para o login...");
    window.setTimeout(() => {
      router.replace("/login?message=Senha redefinida com sucesso.");
    }, 900);
  }

  const disabled = status !== "ready";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">{message}</div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/78">Nova senha</span>
        <PasswordInput
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={disabled}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)] disabled:opacity-60"
          placeholder="********"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/78">Confirmar nova senha</span>
        <PasswordInput
          name="confirm_password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={disabled}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)] disabled:opacity-60"
          placeholder="********"
        />
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)] transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
