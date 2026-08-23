"use server";

import { redirect } from "next/navigation";
import { sendPasswordRecoveryEmailWithResend } from "@/backend/integrations/resend-lead-email";
import { getCurrentMembershipRecord } from "@/backend/repos/memberships-repo";
import { ensureEmployeeWorkSessionOpen, closeEmployeeWorkSessionByAuthUser } from "@/backend/repos/employee-work-sessions-repo";
import { getAppUrl } from "@/backend/shared/app-url";
import { resolveLoginDestinationUseCase } from "@/backend/use-cases/auth/resolve-login-destination";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(error.message)}`);
  }

  if (data.user?.id) {
    const membership = await getCurrentMembershipRecord(data.user.id);
    if (membership?.role === "operator") {
      await ensureEmployeeWorkSessionOpen({
        tenantId: membership.tenant_id,
        authUserId: data.user.id,
      });
    }
  }

  redirect(await resolveLoginDestinationUseCase());
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(error.message)}`);
  }

  if (!data.session) {
    redirect("/login?message=Conta criada. Verifique seu e-mail para continuar.");
  }

  redirect(await resolveLoginDestinationUseCase());
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const redirectTo = `${getAppUrl()}/login/redefinir`;

  if (!email) {
    redirect("/login?error=Informe o e-mail para recuperar a senha.");
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    const recoveryUrl = data.properties?.action_link?.trim();

    if (!recoveryUrl) {
      throw new Error("Nao foi possivel gerar o link de redefinicao.");
    }

    await sendPasswordRecoveryEmailWithResend({
      to: email,
      recoveryUrl,
    });

    redirect("/login?message=Enviamos o link de redefinicao para o seu e-mail.");
  } catch (error) {
    console.error("[forgotPasswordAction] custom recovery flow failed", error);

    const supabase = await createSupabaseServerClient();
    const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (fallbackError) {
      redirect("/login?error=Falha ao enviar o link de redefinicao. Tente novamente em instantes.");
    }

    redirect("/login?message=Enviamos o link de redefinicao para o seu e-mail.");
  }
}

export async function signOutAction() {
  const context = await resolveAccessContext();

  if (context.kind === "tenant_user" && context.role === "operator") {
    await closeEmployeeWorkSessionByAuthUser({
      tenantId: context.tenantId,
      authUserId: context.userId,
      endedByShift: false,
    });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
