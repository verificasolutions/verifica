import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeRecord, EmployeeWorkSessionRecord } from "@/backend/types";

export async function listActiveEmployeeSessionsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("employee_work_sessions")
    .select("id, tenant_id, employee_id, auth_user_id, logged_in_at, logged_out_at, ended_by_shift, created_at")
    .eq("tenant_id", tenantId)
    .is("logged_out_at", null)
    .order("logged_in_at", { ascending: false });

  return ((data ?? []) as EmployeeWorkSessionRecord[]).map((item) => ({
    ...item,
    washed_count: 0,
    dried_count: 0,
  }));
}

export async function ensureEmployeeWorkSessionOpen(input: {
  tenantId: string;
  authUserId: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data: employee } = await admin
    .from("employees")
    .select("id, tenant_id, auth_user_id, is_active, can_access_system")
    .eq("tenant_id", input.tenantId)
    .eq("auth_user_id", input.authUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (!employee?.id || !employee.can_access_system) {
    return null;
  }

  const { data: openSession } = await admin
    .from("employee_work_sessions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("employee_id", employee.id)
    .is("logged_out_at", null)
    .maybeSingle();

  if (!openSession?.id) {
    await admin.from("employee_work_sessions").insert({
      tenant_id: input.tenantId,
      employee_id: employee.id,
      auth_user_id: input.authUserId,
      logged_in_at: new Date().toISOString(),
      ended_by_shift: false,
    });
  }

  await admin
    .from("employees")
    .update({
      is_present: true,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", employee.id);

  return employee as Pick<EmployeeRecord, "id" | "tenant_id" | "auth_user_id">;
}

export async function closeEmployeeWorkSessionByAuthUser(input: {
  tenantId: string;
  authUserId: string;
  endedByShift?: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data: employee } = await admin
    .from("employees")
    .select("id, tenant_id")
    .eq("tenant_id", input.tenantId)
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (!employee?.id) {
    return null;
  }

  await admin
    .from("employee_work_sessions")
    .update({
      logged_out_at: new Date().toISOString(),
      ended_by_shift: input.endedByShift ?? false,
    })
    .eq("tenant_id", input.tenantId)
    .eq("employee_id", employee.id)
    .is("logged_out_at", null);

  await admin
    .from("employees")
    .update({
      is_present: false,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", employee.id);

  return employee.id as string;
}

export async function closeAllEmployeeWorkSessionsByTenant(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;

  await admin
    .from("employee_work_sessions")
    .update({
      logged_out_at: new Date().toISOString(),
      ended_by_shift: true,
    })
    .eq("tenant_id", tenantId)
    .is("logged_out_at", null);

  await admin
    .from("employees")
    .update({
      is_present: false,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("is_present", true);
}

export async function listEmployeeWorkHistoryByEmployee(tenantId: string, employeeId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: sessions }, { data: attendances }] = await Promise.all([
    supabase
      .from("employee_work_sessions")
      .select("id, tenant_id, employee_id, auth_user_id, logged_in_at, logged_out_at, ended_by_shift, created_at")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .order("logged_in_at", { ascending: false })
      .limit(60),
    supabase
      .from("attendances")
      .select("id, started_at, ready_at, employee_id, status")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows = (sessions ?? []) as EmployeeWorkSessionRecord[];
  const attendanceRows = (attendances ?? []) as Array<{
    id: string;
    started_at: string | null;
    ready_at: string | null;
    employee_id: string | null;
    status: string;
  }>;

  return rows.map((session) => {
    const sessionDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(session.logged_in_at));

    const washed = new Set(
      attendanceRows
        .filter((item) => item.started_at)
        .filter((item) =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(item.started_at as string)) === sessionDay,
        )
        .map((item) => item.id),
    );

    const dried = new Set(
      attendanceRows
        .filter((item) => item.ready_at)
        .filter((item) =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(item.ready_at as string)) === sessionDay,
        )
        .map((item) => item.id),
    );

    return {
      ...session,
      washed_count: washed.size,
      dried_count: dried.size,
    };
  });
}
