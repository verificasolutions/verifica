"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { resolveTenantEntryUseCase } from "@/backend/use-cases/customer/resolve-tenant-entry";
import { submitPhonePlateUseCase } from "@/backend/use-cases/customer/submit-phone-plate";
import { loginCustomerUseCase } from "@/backend/use-cases/customer/login";
import { registerCustomerUseCase } from "@/backend/use-cases/customer/register";
import { setCustomerSessionCookie } from "@/backend/auth/customer-session";
import { findActiveTenantBySlug } from "@/backend/repos/tenant-lookup-repo";

const ENTRY_TOKEN_COOKIE = "vw_entry_token";

/** Monta a URL do passo com URLSearchParams (que já codifica). NUNCA pré-codificar. */
function entryUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/cliente/entrar?${search.toString()}`;
}

/** redirect() do Next lança NEXT_REDIRECT — nunca tratar como erro de fluxo. */
function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Mensagem amigável e SEMPRE preenchida para qualquer exceção (nunca alert vazio). */
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/muitas tentativas/i.test(message)) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  return "Não foi possível consultar agora. Tente novamente.";
}

export async function resolveTenantAction(formData: FormData) {
  const slug = String(formData.get("tenant") ?? "").trim();
  try {
    const result = await resolveTenantEntryUseCase({ tenantSlug: slug });

    if (result.error || !result.data) {
      redirect(entryUrl({ error: result.error ?? "Local inválido." }));
    }

    redirect(entryUrl({ tenant: result.data.slug, step: "2" }));
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(entryUrl({ error: friendlyError(error) }));
  }
}

export async function submitPhonePlateAction(formData: FormData) {
  const slug = String(formData.get("tenant") ?? "").trim();
  try {
    const tenant = await findActiveTenantBySlug(slug);
    if (!tenant) {
      redirect(entryUrl({ tenant: slug, error: "Local inválido." }));
    }

    const result = await submitPhonePlateUseCase({
      tenantId: tenant.id,
      phone: String(formData.get("phone") ?? ""),
      plate: String(formData.get("plate") ?? ""),
    });

    if (result.error || !result.data) {
      redirect(entryUrl({ tenant: slug, step: "2", error: result.error ?? "Erro." }));
    }

    const cookieStore = await cookies();
    cookieStore.set(ENTRY_TOKEN_COOKIE, result.data.entryToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    redirect(
      entryUrl({
        tenant: slug,
        step: "3",
        mode: result.data.mode,
        vehicle: result.data.vehicleExists ? "existing" : "new",
        phone: result.data.phoneNormalized,
        plate: result.data.plateNormalized,
      }),
    );
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(entryUrl({ tenant: slug, step: "2", error: friendlyError(error) }));
  }
}

export async function loginAction(formData: FormData) {
  const slug = String(formData.get("tenant") ?? "").trim();
  const mode = String(formData.get("mode") ?? "login");
  const phone = String(formData.get("phone") ?? "");
  const plate = String(formData.get("plate") ?? "");
  try {
    const tenant = await findActiveTenantBySlug(slug);
    if (!tenant) {
      redirect(entryUrl({ tenant: slug, step: "3", mode, phone, plate, error: "Verifique seus dados." }));
    }

    const cookieStore = await cookies();
    const entryToken = cookieStore.get(ENTRY_TOKEN_COOKIE)?.value ?? "";

    const result = await loginCustomerUseCase({
      tenantId: tenant.id,
      entryToken,
      password: String(formData.get("password") ?? ""),
      vehicleModel: String(formData.get("vehicleModel") ?? ""),
      vehicleType: String(formData.get("vehicleType") ?? ""),
      vehicleColor: String(formData.get("vehicleColor") ?? ""),
    });

    if (result.error || !result.data) {
      redirect(entryUrl({ tenant: slug, step: "3", mode, phone, plate, error: result.error ?? "Verifique seus dados." }));
    }

    await setCustomerSessionCookie(result.data.token, result.data.expiresAt);
    cookieStore.delete(ENTRY_TOKEN_COOKIE);
    redirect("/cliente/portal");
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(entryUrl({ tenant: slug, step: "3", mode, phone, plate, error: friendlyError(error) }));
  }
}

export async function registerAction(formData: FormData) {
  const slug = String(formData.get("tenant") ?? "").trim();
  const mode = String(formData.get("mode") ?? "register");
  const phone = String(formData.get("phone") ?? "");
  const plate = String(formData.get("plate") ?? "");
  const vehicle = String(formData.get("vehicle") ?? "new");
  const privacyAccepted = String(formData.get("privacyAccepted") ?? "") === "on";
  try {
    const tenant = await findActiveTenantBySlug(slug);
    if (!tenant) {
      redirect(entryUrl({ tenant: slug, step: "3", mode, vehicle, phone, plate, error: "Verifique seus dados." }));
    }

    const cookieStore = await cookies();
    const entryToken = cookieStore.get(ENTRY_TOKEN_COOKIE)?.value ?? "";

    const result = await registerCustomerUseCase({
      tenantId: tenant.id,
      entryToken,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      vehicleModel: String(formData.get("vehicleModel") ?? ""),
      vehicleType: String(formData.get("vehicleType") ?? ""),
      vehicleColor: String(formData.get("vehicleColor") ?? ""),
      password: String(formData.get("password") ?? ""),
      privacyAccepted,
      privacyPolicyVersion: "1.0",
      userAgent: (await headers()).get("user-agent"),
    });

    if (result.error || !result.data) {
      redirect(entryUrl({ tenant: slug, step: "3", mode, vehicle, phone, plate, error: result.error ?? "Verifique seus dados." }));
    }

    await setCustomerSessionCookie(result.data.token, result.data.expiresAt);
    cookieStore.delete(ENTRY_TOKEN_COOKIE);
    redirect("/cliente/portal");
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(entryUrl({ tenant: slug, step: "3", mode, vehicle, phone, plate, error: friendlyError(error) }));
  }
}
