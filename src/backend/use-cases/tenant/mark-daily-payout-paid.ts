import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEmployeeById } from "@/backend/repos/employees-repo";

export async function markDailyPayoutPaidUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const employeeId = String(formData.get("employee_id") ?? "").trim();

  if (!employeeId) {
    redirect("/app/dashboard?section=caixa&error=Diária inválida.");
  }

  const employee = await getEmployeeById(context.tenantId, employeeId);
  if (!employee || employee.payment_type !== "daily" || !employee.is_present) {
    redirect("/app/dashboard?section=caixa&error=Funcionário inválido para diária.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_daily_payout_paid_atomic", {
    p_employee_id: employeeId,
  });

  if (error) {
    redirect(`/app/dashboard?section=caixa&error=${encodeURIComponent(error.message)}`);
  }
}
