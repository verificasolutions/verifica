import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import {
  countActiveTenantsAdmin,
  countOwnersAdmin,
  countTenantsAdmin,
  listRecentTenantsAdmin,
} from "@/backend/repos/tenants-admin-repo";
import {
  countAttendancesAdmin,
  countNewTenantsThisMonthAdmin,
  getAdminRevenueMetrics,
  getPlatformSettingsAdmin,
  listAuditLogsAdmin,
  listPlatformUsersAdmin,
  listPlansAdmin,
  listSubscriptionsAdmin,
  listSupportTicketsAdmin,
} from "@/backend/repos/admin-control-repo";
import { listCommercialIntakesAdmin } from "@/backend/repos/commercial-intakes-repo";
import { listTenantCompanyProfilesAdmin } from "@/backend/repos/tenant-company-profiles-admin-repo";

export async function getAdminDashboardUseCase() {
  const admin = await requirePlatformAdmin();
  const [
    tenantCount,
    activeTenantCount,
    ownerCount,
    newTenantsThisMonth,
    attendancesTotal,
    finance,
    tenants,
    plans,
    subscriptions,
    companyProfiles,
    users,
    supportTickets,
    commercialIntakes,
    settings,
    logs,
  ] = await Promise.all([
    countTenantsAdmin(),
    countActiveTenantsAdmin(),
    countOwnersAdmin(),
    countNewTenantsThisMonthAdmin(),
    countAttendancesAdmin(),
    getAdminRevenueMetrics(),
    listRecentTenantsAdmin(),
    listPlansAdmin(),
    listSubscriptionsAdmin(),
    listTenantCompanyProfilesAdmin(),
    listPlatformUsersAdmin(),
    listSupportTicketsAdmin(),
    listCommercialIntakesAdmin(),
    getPlatformSettingsAdmin(),
    listAuditLogsAdmin(),
  ]);

  return {
    admin,
    stats: {
      tenantCount,
      activeTenantCount,
      ownerCount,
      newTenantsThisMonth,
      attendancesTotal,
      mrr: finance.mrr,
      trialCount: subscriptions.filter((item) => item.status === "trialing").length,
      pastDueCount: subscriptions.filter((item) => item.status === "past_due").length,
      activeUsers: users.filter((item) => item.lastAccess).length,
    },
    finance,
    tenants,
    plans,
    subscriptions,
    companyProfiles,
    users,
    supportTickets,
    commercialIntakes,
    settings,
    logs,
  };
}
