import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listSupportTicketsByTenant } from "@/backend/repos/support-tickets-repo";

export async function getTenantSupportUseCase() {
  const context = await requireOwnerOrManager();
  const tickets = await listSupportTicketsByTenant(context.tenantId);

  return {
    tickets,
    counts: {
      open: tickets.filter((item) => item.status === "open").length,
      inProgress: tickets.filter((item) => item.status === "in_progress").length,
      resolved: tickets.filter((item) => item.status === "resolved").length,
    },
  };
}
