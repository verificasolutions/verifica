import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantOperationalProfile } from "@/backend/types";

export async function seedDefaultOperationBoxesAdmin(tenantId: string, operationalProfile: TenantOperationalProfile = "automotive") {
  const admin = createSupabaseAdminClient() as any;
  const boxes =
    operationalProfile === "generic"
      ? [
          {
            tenant_id: tenantId,
            name: "Entrada",
            code: "ENTRY-01",
            kind: "entry",
            sort_order: 10,
            sla_minutes: null,
            sla_unit: "minutes",
            color_token: "hazard",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Execução",
            code: "WORK-01",
            kind: "wash",
            sort_order: 20,
            sla_minutes: 60,
            sla_unit: "minutes",
            color_token: "wash",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Conferência",
            code: "CHECK-01",
            kind: "dry",
            sort_order: 30,
            sla_minutes: 30,
            sla_unit: "minutes",
            color_token: "dry",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Concluído",
            code: "DONE-01",
            kind: "ready",
            sort_order: 40,
            sla_minutes: null,
            sla_unit: "minutes",
            color_token: "ready",
            is_active: true,
          },
        ]
      : [
          {
            tenant_id: tenantId,
            name: "Esteira de entrada",
            code: "ENTRY-01",
            kind: "entry",
            sort_order: 10,
            sla_minutes: null,
            sla_unit: "minutes",
            color_token: "hazard",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Box 01 - Lavagem",
            code: "BOX-01",
            kind: "wash",
            sort_order: 20,
            sla_minutes: 30,
            sla_unit: "minutes",
            color_token: "wash",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Box 02 - Secagem",
            code: "BOX-02",
            kind: "dry",
            sort_order: 30,
            sla_minutes: 20,
            sla_unit: "minutes",
            color_token: "dry",
            is_active: true,
          },
          {
            tenant_id: tenantId,
            name: "Retirada",
            code: "READY-01",
            kind: "ready",
            sort_order: 40,
            sla_minutes: null,
            sla_unit: "minutes",
            color_token: "ready",
            is_active: true,
          },
        ];

  const { error } = await admin.from("operation_boxes").upsert(boxes, { onConflict: "tenant_id,code" });

  return error as { message: string } | null;
}
