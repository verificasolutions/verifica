import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { listPendingLandingCommentsByTenant, updateLandingCommentStatus } from "@/backend/repos/landing-engagement-repo";

export async function listPendingLandingCommentsUseCase() {
  const context = await requireOwnerOrManager();
  return listPendingLandingCommentsByTenant(context.tenantId);
}

/** Fluxo de revisão de comentários (owner/manager): aprovar ou rejeitar; auditado. */
export async function reviewLandingCommentUseCase(input: { commentId: string; status: "approved" | "rejected" }) {
  const context = await requireOwnerOrManager();

  const error = await updateLandingCommentStatus({
    tenantId: context.tenantId,
    commentId: input.commentId,
    status: input.status,
    reviewedBy: context.userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLogAdmin({
    actor_user_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: context.tenantId,
    action: input.status === "approved" ? "landing.comment.approved" : "landing.comment.rejected",
    entity_type: "landing_comment",
    entity_id: input.commentId,
    message: `Comentário ${input.status} no feed da landing`,
    metadata: {},
  });
}
