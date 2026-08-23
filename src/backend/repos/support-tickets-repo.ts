import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupportTicketRecord } from "@/backend/types";

export async function listSupportTicketsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, tenant_id, subject, description, status, admin_reply, admin_reply_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  return ((data ?? []) as SupportTicketRecord[]).map((item) => ({
    id: item.id,
    tenant_id: item.tenant_id,
    subject: item.subject,
    description: item.description,
    status: item.status,
    admin_reply: item.admin_reply ?? null,
    admin_reply_at: item.admin_reply_at ?? null,
    created_at: item.created_at,
  }));
}

export async function createSupportTicketForTenant(input: {
  tenantId: string;
  createdBy: string;
  subject: string;
  description: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("support_tickets").insert({
    tenant_id: input.tenantId,
    created_by: input.createdBy,
    subject: input.subject,
    description: input.description,
    status: "open",
  });

  return error as { message: string } | null;
}
