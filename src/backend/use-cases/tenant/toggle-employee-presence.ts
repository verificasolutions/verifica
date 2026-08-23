import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEmployeeById } from "@/backend/repos/employees-repo";

export async function toggleEmployeePresenceUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const employeeId = String(formData.get("employee_id") ?? "");
  const isPresent = String(formData.get("is_present") ?? "") === "true";
  const employee = await getEmployeeById(context.tenantId, employeeId);

  if (!employee) {
    redirect("/app/dashboard?error=Funcionário não encontrado.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("toggle_employee_presence_atomic", {
    p_employee_id: employeeId,
    p_is_present: isPresent,
  });

  if (error) {
    redirect(`/app/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
