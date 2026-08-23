import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantGrowthProgressRecord } from "@/backend/types";

export async function listTenantGrowthProgressByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_growth_progress")
    .select("id, tenant_id, step_key, notes, completed, completed_at, updated_by, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  return (data ?? []) as TenantGrowthProgressRecord[];
}

export async function upsertTenantGrowthProgress(input: {
  tenantId: string;
  stepKey: string;
  notes: string | null;
  completed: boolean;
  updatedBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const payload = {
    tenant_id: input.tenantId,
    step_key: input.stepKey,
    notes: input.notes,
    completed: input.completed,
    completed_at: input.completed ? new Date().toISOString() : null,
    updated_by: input.updatedBy,
  };

  const { error } = await supabase.from("tenant_growth_progress").upsert(payload, {
    onConflict: "tenant_id,step_key",
  });

  return error as { message: string } | null;
}
