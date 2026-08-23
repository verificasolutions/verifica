"use server";

import { redirect } from "next/navigation";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { completeAnonymousUserSetupUseCase } from "@/backend/use-cases/tenant/complete-setup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeSetupAction(formData: FormData) {
  const context = await resolveAccessContext();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (context.kind === "platform_admin") redirect("/admin");
  if (context.kind === "tenant_user") {
    redirect(context.role === "operator" ? "/operador/dashboard" : "/app/dashboard");
  }

  await completeAnonymousUserSetupUseCase(formData, user.id);
  redirect("/app/dashboard");
}
