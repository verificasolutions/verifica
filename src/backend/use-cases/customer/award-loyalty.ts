/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Concessão de fidelidade (backend-only; service_role). A fiação no fluxo operacional
 * (ordem concluída -> awarded) é feita na Fase 5. Nunca na confirmação da contratação.
 */
export async function awardLoyaltyWashForOrderUseCase(input: { attendanceId: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("award_loyalty_wash", {
    p_attendance_id: input.attendanceId,
  });

  if (error) {
    throw new Error(`Falha ao conceder fidelidade: ${error.message}`);
  }

  return (data as string | null) ?? null;
}
