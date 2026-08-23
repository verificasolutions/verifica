import "server-only";
import { redirect } from "next/navigation";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";

export async function assertOperatorInventoryEnabled(tenantId: string) {
  const settings = await getTenantSettings(tenantId);

  if (!settings?.operator_inventory_enabled) {
    redirect("/operador/dashboard?error=Estoque não liberado para este operador.");
  }

  return settings;
}
