import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, updateSupportTicketStatusAdmin } from "@/backend/repos/admin-control-repo";

export async function updateSupportTicketUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as "open" | "in_progress" | "resolved";
  const adminReply = String(formData.get("admin_reply") ?? "").trim();

  if (!ticketId || !status) {
    redirect("/admin?section=suporte&error=Ticket inválido.");
  }

  const error = await updateSupportTicketStatusAdmin(ticketId, {
    status,
    adminReply: adminReply || null,
    adminReplyBy: admin.userId,
  });

  if (error) {
    redirect(`/admin?section=suporte&error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    action: "support.updated",
    entity_type: "support_ticket",
    entity_id: ticketId,
    message: `${admin.email ?? "admin"} atualizou um ticket para ${status}.`,
  });
}
