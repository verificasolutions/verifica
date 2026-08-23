import "server-only";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function claimAttendanceUseCase(formData: FormData) {
  await requireOperator();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("claim_attendance_atomic", {
    p_attendance_id: attendanceId,
  });

  if (error) {
    redirect(`/operador/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}
