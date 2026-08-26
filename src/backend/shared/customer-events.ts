/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Registra evento auditável de ação do cliente (entity.action) em audit_logs.
 * Escrita server-side via admin client; mensagem nunca contém segredos.
 * Não lança exceção: falha de auditoria é logada no console (não quebra o fluxo).
 */
export async function logCustomerAction(input: {
  tenantId: string;
  customerId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: null,
    actor_email: null,
    actor_customer_id: input.customerId,
    actor_role: "customer",
    tenant_id: input.tenantId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Falha ao registrar evento de auditoria do cliente", {
      tenantId: input.tenantId,
      customerId: input.customerId,
      action: input.action,
      reason: error.message,
    });
    // Fail-closed: eventos obrigatórios não podem ser perdidos silenciosamente.
    throw new Error("Falha ao registrar auditoria.");
  }
}
