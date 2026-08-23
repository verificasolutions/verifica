/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { startOfMonth, subMonths } from "date-fns";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AuditLogRecord,
  PlanRecord,
  PlatformSettingsRecord,
  SupportTicketRecord,
  TenantRecord,
  TenantSubscriptionRecord,
} from "@/backend/types";

function mapPlan(row: any): PlanRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    price_monthly: Number(row.price_monthly ?? 0),
    operator_limit: row.operator_limit ?? null,
    appointment_limit: row.appointment_limit ?? null,
    whatsapp_limit: row.whatsapp_limit ?? null,
    features: Array.isArray(row.features) ? row.features : [],
    is_active: Boolean(row.is_active),
  };
}

function mapTenant(row: any): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    whatsapp: row.whatsapp,
    operational_profile: row.operational_profile ?? "automotive",
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

function resolveSubscriptionAmount(row: { amount?: unknown; plans?: { price_monthly?: unknown } | null }) {
  const directAmount = Number(row.amount ?? 0);
  if (Number.isFinite(directAmount) && directAmount > 0) {
    return directAmount;
  }

  const planAmount = Number(row.plans?.price_monthly ?? 0);
  return Number.isFinite(planAmount) ? planAmount : 0;
}

export async function listPlansAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("plans").select("*").order("price_monthly", { ascending: true });
  return ((data ?? []) as any[]).map(mapPlan);
}

export async function findPlanByCodeAdmin(code: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("plans").select("*").eq("code", code).maybeSingle();
  return data ? mapPlan(data) : null;
}

export async function upsertPlanAdmin(input: {
  id?: string;
  code: string;
  name: string;
  price_monthly: number;
  operator_limit: number | null;
  appointment_limit: number | null;
  whatsapp_limit: number | null;
  features: string[];
  is_active: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    code: input.code,
    name: input.name,
    price_monthly: input.price_monthly,
    operator_limit: input.operator_limit,
    appointment_limit: input.appointment_limit,
    whatsapp_limit: input.whatsapp_limit,
    features: input.features,
    is_active: input.is_active,
  };

  const { error } = await admin.from("plans").upsert(payload);
  return error as { message: string } | null;
}

export async function listSubscriptionsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("tenant_subscriptions")
    .select(`
      id, tenant_id, plan_id, status, amount, billing_cycle, trial_ends_at, current_period_end, canceled_at,
      plans(id, code, name, price_monthly, operator_limit, appointment_limit, whatsapp_limit, features, is_active),
      tenants(id, name, slug, whatsapp, is_active, created_at, created_by)
    `)
    .order("created_at", { ascending: false });

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    plan_id: row.plan_id,
    status: row.status,
    plans: row.plans ? mapPlan(Array.isArray(row.plans) ? row.plans[0] : row.plans) : null,
    tenants: row.tenants ? mapTenant(Array.isArray(row.tenants) ? row.tenants[0] : row.tenants) : null,
    amount: resolveSubscriptionAmount({
      amount: row.amount,
      plans: row.plans ? mapPlan(Array.isArray(row.plans) ? row.plans[0] : row.plans) : null,
    }),
    billing_cycle: row.billing_cycle,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    canceled_at: row.canceled_at,
  })) as TenantSubscriptionRecord[];
}

export async function upsertSubscriptionAdmin(input: {
  tenant_id: string;
  plan_id: string | null;
  status: TenantSubscriptionRecord["status"];
  amount: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenant_subscriptions").upsert(
    {
      tenant_id: input.tenant_id,
      plan_id: input.plan_id,
      status: input.status,
      amount: input.amount,
      current_period_end: input.current_period_end,
      trial_ends_at: input.trial_ends_at,
    },
    { onConflict: "tenant_id" },
  );

  return error as { message: string } | null;
}

export async function listSupportTicketsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("support_tickets")
    .select("id, tenant_id, subject, description, status, admin_reply, admin_reply_at, created_at, tenants(id, name, slug, whatsapp, is_active, created_at, created_by)")
    .order("created_at", { ascending: false })
    .limit(50);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    admin_reply: row.admin_reply ?? null,
    admin_reply_at: row.admin_reply_at ?? null,
    created_at: row.created_at,
    tenants: row.tenants ? mapTenant(Array.isArray(row.tenants) ? row.tenants[0] : row.tenants) : null,
  })) as SupportTicketRecord[];
}

export async function updateSupportTicketStatusAdmin(ticketId: string, input: { status: SupportTicketRecord["status"]; adminReply?: string | null; adminReplyBy?: string | null }) {
  const admin = createSupabaseAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: input.status,
    admin_reply: input.adminReply ?? null,
    admin_reply_at: input.adminReply ? new Date().toISOString() : null,
    admin_reply_by: input.adminReply ? input.adminReplyBy ?? null : null,
  };
  const { error } = await admin.from("support_tickets").update(patch).eq("id", ticketId);
  return error as { message: string } | null;
}

export async function getPlatformSettingsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("platform_settings").select("*").eq("key", "default").maybeSingle();
  return (data as PlatformSettingsRecord | null) ?? null;
}

export async function upsertPlatformSettingsAdmin(input: PlatformSettingsRecord) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("platform_settings").upsert(input);
  return error as { message: string } | null;
}

function buildDefaultPlatformSettings(): PlatformSettingsRecord {
  return {
    key: "default",
    platform_name: "Verifica",
    logo_url: null,
    primary_domain: null,
    smtp_host: null,
    smtp_port: null,
    smtp_username: null,
    smtp_password: null,
    smtp_from_email: null,
    resend_from_email: null,
    resend_reply_to_email: null,
    resend_webhook_id: null,
    resend_webhook_secret: null,
    whatsapp_provider: null,
    whatsapp_base_url: null,
    evolution_instance: null,
    evolution_api_key: null,
    evolution_enabled: false,
    default_return_reminder_enabled: true,
    default_return_reminder_days: 30,
    default_return_reminder_time: "09:00",
    default_queue_entry_message: null,
    default_wash_start_message: null,
    default_ready_message: null,
    default_return_reminder_message: null,
  };
}

export async function patchPlatformSettingsAdmin(patch: Partial<PlatformSettingsRecord>) {
  const current = await getPlatformSettingsAdmin();
  return upsertPlatformSettingsAdmin({
    ...buildDefaultPlatformSettings(),
    ...(current ?? {}),
    ...patch,
    key: patch.key ?? current?.key ?? "default",
  });
}

export async function listAuditLogsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("audit_logs")
    .select("id, actor_user_id, actor_email, actor_role, tenant_id, action, entity_type, entity_id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as any[]) as AuditLogRecord[];
}

export async function createAuditLogAdmin(input: {
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string;
  tenant_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: input.actor_user_id,
    actor_email: input.actor_email,
    actor_role: input.actor_role,
    tenant_id: input.tenant_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
  });

  return error as { message: string } | null;
}

export async function countNewTenantsThisMonthAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const monthStart = startOfMonth(new Date()).toISOString();
  const { count } = await admin.from("tenants").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
  return count ?? 0;
}

export async function countAttendancesAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("attendances").select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdminRevenueMetrics() {
  const admin = createSupabaseAdminClient() as any;
  const [subscriptions, activeCount, canceledThisMonth, previousMonthCanceled] = await Promise.all([
    listSubscriptionsAdmin(),
    admin.from("tenant_subscriptions").select("*", { count: "exact", head: true }).in("status", ["active", "trialing", "past_due"]),
    admin.from("tenant_subscriptions").select("*", { count: "exact", head: true }).gte("canceled_at", startOfMonth(new Date()).toISOString()),
    admin
      .from("tenant_subscriptions")
      .select("*", { count: "exact", head: true })
      .gte("canceled_at", startOfMonth(subMonths(new Date(), 1)).toISOString())
      .lt("canceled_at", startOfMonth(new Date()).toISOString()),
  ]);

  const recurringRows = subscriptions.filter((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due");
  const mrr = recurringRows.reduce((total, item) => total + resolveSubscriptionAmount(item), 0);
  const monthlyRevenue = subscriptions
    .filter((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due")
    .reduce((total, item) => total + resolveSubscriptionAmount(item), 0);
  const activeCustomers = activeCount.count ?? 0;
  const churnBase = activeCustomers + (canceledThisMonth.count ?? 0);
  const churn = churnBase > 0 ? ((canceledThisMonth.count ?? 0) / churnBase) * 100 : 0;

  return {
    mrr,
    arr: mrr * 12,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
    activeCustomers,
    canceledThisMonth: canceledThisMonth.count ?? 0,
    previousMonthCanceled: previousMonthCanceled.count ?? 0,
    churn,
  };
}

export async function listPlatformUsersAdmin() {
  const admin = createSupabaseAdminClient();
  const [usersResult, membershipsResult, tenantsResult, platformAdminsResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    (admin as any).from("tenant_users").select("user_id, role, tenant_id, is_active"),
    (admin as any).from("tenants").select("id, name, slug, whatsapp, is_active, created_at, created_by"),
    (admin as any).from("platform_admins").select("user_id, role, is_active"),
  ]);

  const memberships = membershipsResult.data ?? [];
  const tenants = new Map<string, any>(((tenantsResult.data ?? []) as any[]).map((row) => [row.id, row]));
  const platformAdmins = new Map<string, any>(((platformAdminsResult.data ?? []) as any[]).map((row) => [row.user_id, row]));

  return usersResult.data.users.map((user) => {
    const membership = memberships.find((item: any) => item.user_id === user.id && item.is_active);
    const platformAdmin = platformAdmins.get(user.id);
    const tenant = membership?.tenant_id ? tenants.get(membership.tenant_id) : null;

    return {
      id: user.id,
      name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Sem nome",
      email: user.email ?? "",
      tenantName: tenant?.name ?? "Plataforma",
      profile: platformAdmin ? "Admin Master" : membership?.role === "operator" ? "Operador" : membership ? "Tenant" : "Sem vínculo",
      lastAccess: user.last_sign_in_at ?? user.created_at ?? null,
      isBlocked: Boolean(user.banned_until),
    };
  });
}

export async function getTenantPreviewAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const [tenantResult, subscriptionResult, companyProfileResult, attendancesResult, customersResult, vehiclesResult, servicesResult, employeesResult] =
    await Promise.all([
      admin.from("tenants").select("id, name, slug, whatsapp, is_active, created_at, created_by").eq("id", tenantId).maybeSingle(),
      admin
        .from("tenant_subscriptions")
        .select(`
          id, tenant_id, plan_id, status, amount, billing_cycle, trial_ends_at, current_period_end, canceled_at,
          plans(id, code, name, price_monthly, operator_limit, appointment_limit, whatsapp_limit, features, is_active)
        `)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin.from("tenant_company_profiles").select("*").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("attendances").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      admin.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      admin.from("vehicles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      admin.from("services").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      admin.from("employees").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]);

  if (!tenantResult.data) {
    return null;
  }

  const subscriptionRow = subscriptionResult.data;

  return {
    tenant: mapTenant(tenantResult.data),
    companyProfile: companyProfileResult.data ?? null,
    subscription: subscriptionRow
      ? ({
          id: subscriptionRow.id,
          tenant_id: subscriptionRow.tenant_id,
          plan_id: subscriptionRow.plan_id,
          status: subscriptionRow.status,
          plans: subscriptionRow.plans ? mapPlan(Array.isArray(subscriptionRow.plans) ? subscriptionRow.plans[0] : subscriptionRow.plans) : null,
          amount: resolveSubscriptionAmount({
            amount: subscriptionRow.amount,
            plans: subscriptionRow.plans ? mapPlan(Array.isArray(subscriptionRow.plans) ? subscriptionRow.plans[0] : subscriptionRow.plans) : null,
          }),
          billing_cycle: subscriptionRow.billing_cycle,
          trial_ends_at: subscriptionRow.trial_ends_at,
          current_period_end: subscriptionRow.current_period_end,
          canceled_at: subscriptionRow.canceled_at,
        } as TenantSubscriptionRecord)
      : null,
    stats: {
      attendances: attendancesResult.count ?? 0,
      customers: customersResult.count ?? 0,
      vehicles: vehiclesResult.count ?? 0,
      services: servicesResult.count ?? 0,
      employees: employeesResult.count ?? 0,
    },
  };
}

export async function getTenantWorkspaceAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const [preview, servicesResult, queueResult, customersResult, employeesResult, appointmentsResult, cashSessionResult, cashEntriesResult, tenantSettingsResult] =
    await Promise.all([
      getTenantPreviewAdmin(tenantId),
      admin
        .from("services")
        .select("id, tenant_id, name, price, average_minutes, short_description, kind, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(12),
      admin
        .from("attendances")
        .select(`
          id, tenant_id, customer_id, vehicle_id, service_id, employee_id, status, estimated_minutes, final_price, payment_method, public_code, created_at,
          customers(name),
          vehicles(plate, model, color),
          services(name),
          employees(name)
        `)
        .eq("tenant_id", tenantId)
        .not("status", "in", "(delivered,canceled)")
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("customers")
        .select("id, tenant_id, name, whatsapp, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("employees")
        .select("id, tenant_id, name, phone, role_label, can_access_system, payment_type, payment_value, is_active, is_present, auth_user_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      admin
        .from("appointments")
        .select(`
          id, tenant_id, scheduled_for, status, notes,
          customers(name),
          vehicles(model, plate),
          services(name)
        `)
        .eq("tenant_id", tenantId)
        .order("scheduled_for", { ascending: true })
        .limit(10),
      admin
        .from("cash_sessions")
        .select("id, tenant_id, opened_at, closed_at, opening_balance, closing_balance, status")
        .eq("tenant_id", tenantId)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("cash_entries")
        .select("id, tenant_id, kind, payment_method, description, amount, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("tenant_settings")
        .select(`
          tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
          queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
          finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
          return_reminder_message, return_reminder_enabled,
          return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
          whatsapp_pairing_token,
          evolution_api_key, evolution_enabled, operator_can_edit_status,
          operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
          operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
          landing_enabled,
          instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
          logout_before
        `)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

  if (!preview) {
    return null;
  }

  const cashEntries = (cashEntriesResult.data ?? []) as any[];
  const cashTotals = cashEntries.reduce(
    (acc, item) => {
      const amount = Number(item.amount ?? 0);

      if (item.kind === "expense") {
        acc.expenses += amount;
      } else {
        acc.gross += amount;
        if (item.payment_method === "cash") acc.cash += amount;
        if (item.payment_method === "pix") acc.pix += amount;
        if (item.payment_method === "card") acc.card += amount;
        if (item.payment_method === "pending") acc.pending += amount;
      }

      acc.net = acc.gross - acc.expenses;
      return acc;
    },
    { cash: 0, pix: 0, card: 0, pending: 0, expenses: 0, gross: 0, net: 0 },
  );

  return {
    ...preview,
    services: (servicesResult.data ?? []) as any[],
    queue: (queueResult.data ?? []) as any[],
    customers: (customersResult.data ?? []) as any[],
    employees: (employeesResult.data ?? []) as any[],
    appointments: (appointmentsResult.data ?? []) as any[],
    cashSession: cashSessionResult.data ?? null,
    cashEntries,
    cashTotals,
    tenantSettings: tenantSettingsResult.data ?? null,
  };
}

export async function upsertTenantWhatsappConfigAdmin(input: {
  tenantId: string;
  evolutionBaseUrl: string | null;
  evolutionInstance: string | null;
  evolutionApiKey: string | null;
  evolutionEnabled: boolean;
  customerMessagesEnabled: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const current = await admin
    .from("tenant_settings")
    .select(`
      tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
      queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
      finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
      return_reminder_message, return_reminder_enabled,
      return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
      whatsapp_pairing_token,
      evolution_api_key, evolution_enabled, operator_can_edit_status,
      operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
      operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
      landing_enabled,
      instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
      logout_before
    `)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const row = current.data ?? {
    tenant_id: input.tenantId,
    default_service_minutes: 30,
    customer_messages_enabled: false,
    queue_entry_message: null,
    queue_entry_message_enabled: true,
    wash_start_message: null,
    wash_start_message_enabled: false,
    finishing_message: null,
    finishing_message_enabled: false,
    ready_message: null,
    ready_message_enabled: true,
    return_reminder_message: null,
    return_reminder_enabled: false,
    return_reminder_days: 30,
    return_reminder_time: "09:00",
    whatsapp_pairing_token: crypto.randomUUID(),
    operator_can_edit_status: true,
    operator_can_view_all_cars: true,
    operator_can_view_customer_phone: false,
    operator_inventory_enabled: false,
    operations_mode: "boxes",
    operation_flow_locked: true,
    tv_mode_enabled: false,
    require_ready_photo: false,
    allow_step_photos: true,
    landing_enabled: false,
    instagram_enabled: false,
    instagram_auto_publish_enabled: false,
    instagram_default_publish_mode: "manual",
    logout_before: null,
  };

  const { error } = await admin.from("tenant_settings").upsert({
    ...row,
    evolution_base_url: input.evolutionBaseUrl,
    evolution_instance: input.evolutionInstance,
    evolution_api_key: input.evolutionApiKey,
    evolution_enabled: input.evolutionEnabled,
    customer_messages_enabled: input.customerMessagesEnabled,
  });

  return error as { message: string } | null;
}

export async function upsertTenantInstagramConfigAdmin(input: {
  tenantId: string;
  instagramEnabled: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const current = await admin
    .from("tenant_settings")
    .select(`
      tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
      queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
      finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
      return_reminder_message, return_reminder_enabled,
      return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
      whatsapp_pairing_token,
      evolution_api_key, evolution_enabled, operator_can_edit_status,
      operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
      operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
      landing_enabled,
      instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
      logout_before
    `)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const row = current.data ?? {
    tenant_id: input.tenantId,
    default_service_minutes: 30,
    customer_messages_enabled: false,
    queue_entry_message: null,
    queue_entry_message_enabled: true,
    wash_start_message: null,
    wash_start_message_enabled: false,
    finishing_message: null,
    finishing_message_enabled: false,
    ready_message: null,
    ready_message_enabled: true,
    return_reminder_message: null,
    return_reminder_enabled: false,
    return_reminder_days: 30,
    return_reminder_time: "09:00",
    whatsapp_pairing_token: crypto.randomUUID(),
    operator_can_edit_status: true,
    operator_can_view_all_cars: true,
    operator_can_view_customer_phone: false,
    operator_inventory_enabled: false,
    operations_mode: "boxes",
    operation_flow_locked: true,
    tv_mode_enabled: false,
    require_ready_photo: false,
    allow_step_photos: true,
    landing_enabled: false,
    instagram_enabled: false,
    instagram_auto_publish_enabled: false,
    instagram_default_publish_mode: "manual",
    logout_before: null,
  };

  const { error } = await admin.from("tenant_settings").upsert({
    ...row,
    instagram_enabled: input.instagramEnabled,
    instagram_auto_publish_enabled: false,
    instagram_default_publish_mode: "manual",
  });

  return error as { message: string } | null;
}

export async function upsertTenantLandingConfigAdmin(input: {
  tenantId: string;
  landingEnabled: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const current = await admin
    .from("tenant_settings")
    .select(`
      tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
      queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
      finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
      return_reminder_message, return_reminder_enabled,
      return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
      whatsapp_pairing_token,
      evolution_api_key, evolution_enabled, operator_can_edit_status,
      operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
      operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
      landing_enabled,
      instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
      logout_before
    `)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const row = current.data ?? {
    tenant_id: input.tenantId,
    default_service_minutes: 30,
    customer_messages_enabled: false,
    queue_entry_message: null,
    queue_entry_message_enabled: true,
    wash_start_message: null,
    wash_start_message_enabled: false,
    finishing_message: null,
    finishing_message_enabled: false,
    ready_message: null,
    ready_message_enabled: true,
    return_reminder_message: null,
    return_reminder_enabled: false,
    return_reminder_days: 30,
    return_reminder_time: "09:00",
    whatsapp_pairing_token: crypto.randomUUID(),
    operator_can_edit_status: true,
    operator_can_view_all_cars: true,
    operator_can_view_customer_phone: false,
    operator_inventory_enabled: false,
    operations_mode: "boxes",
    operation_flow_locked: true,
    tv_mode_enabled: false,
    require_ready_photo: false,
    allow_step_photos: true,
    landing_enabled: false,
    instagram_enabled: false,
    instagram_auto_publish_enabled: false,
    instagram_default_publish_mode: "manual",
    logout_before: null,
  };

  const { error } = await admin.from("tenant_settings").upsert({
    ...row,
    landing_enabled: input.landingEnabled,
  });

  return error as { message: string } | null;
}

export async function upsertTenantOperatorInventoryConfigAdmin(input: {
  tenantId: string;
  operatorInventoryEnabled: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const current = await admin
    .from("tenant_settings")
    .select(`
      tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
      queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
      finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
      return_reminder_message, return_reminder_enabled,
      return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
      whatsapp_pairing_token,
      evolution_api_key, evolution_enabled, operator_can_edit_status,
      operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
      operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
      landing_enabled,
      instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
      logout_before
    `)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const row = current.data ?? {
    tenant_id: input.tenantId,
    default_service_minutes: 30,
    customer_messages_enabled: false,
    queue_entry_message: null,
    queue_entry_message_enabled: true,
    wash_start_message: null,
    wash_start_message_enabled: false,
    finishing_message: null,
    finishing_message_enabled: false,
    ready_message: null,
    ready_message_enabled: true,
    return_reminder_message: null,
    return_reminder_enabled: false,
    return_reminder_days: 30,
    return_reminder_time: "09:00",
    whatsapp_pairing_token: crypto.randomUUID(),
    operator_can_edit_status: true,
    operator_can_view_all_cars: true,
    operator_can_view_customer_phone: false,
    operator_inventory_enabled: false,
    operations_mode: "boxes",
    operation_flow_locked: true,
    tv_mode_enabled: false,
    require_ready_photo: false,
    allow_step_photos: true,
    landing_enabled: false,
    instagram_enabled: false,
    instagram_auto_publish_enabled: false,
    instagram_default_publish_mode: "manual",
    logout_before: null,
  };

  const { error } = await admin.from("tenant_settings").upsert({
    ...row,
    operator_inventory_enabled: input.operatorInventoryEnabled,
  });

  return error as { message: string } | null;
}
