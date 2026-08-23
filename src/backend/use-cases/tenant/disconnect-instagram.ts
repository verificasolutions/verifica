import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { disconnectTenantInstagramAccount } from "@/backend/repos/tenant-instagram-repo";

export async function disconnectInstagramUseCase() {
  const context = await requireOwnerOrManager();
  const error = await disconnectTenantInstagramAccount(context.tenantId);

  if (error) {
    redirect(`/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    action: "tenant_instagram.disconnected",
    entity_type: "tenant_instagram_accounts",
    entity_id: context.tenantId,
    message: `${context.email ?? "tenant"} desconectou o Instagram do tenant.`,
  });
}
