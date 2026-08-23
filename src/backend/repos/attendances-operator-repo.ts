import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function assignAttendanceToEmployee(input: {
  tenantId: string;
  attendanceId: string;
  employeeId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendances")
    .update({ employee_id: input.employeeId })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.attendanceId)
    .eq("status", "waiting")
    .is("employee_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return error as { message: string } | null;
  }

  if (!data) {
    return { message: "Esse carro não está mais disponível para assumir." };
  }

  return null;
}
