import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AdminTenantEmployeeForm } from "@/components/admin-tenant-employee-form";
import { FlashNotice } from "@/components/flash-notice";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { getAdminTenantPreviewUseCase } from "@/backend/use-cases/admin/get-admin-tenant-preview";
import {
  deleteTenantEmployeeByAdminAction,
  saveTenantEmployeeByAdminAction,
  setTenantEmployeeStateByAdminAction,
} from "@/app/admin/actions";

type Search = {
  error?: string;
  message?: string;
  drawer?: string;
  employee_id?: string;
};

export default async function AdminTenantUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ tenantId }, { error, message, drawer, employee_id: employeeId }, admin] = await Promise.all([params, searchParams, requirePlatformAdmin()]);
  const preview = await getAdminTenantPreviewUseCase(tenantId);
  const selectedEmployee = preview.employees.find((employee) => employee.id === employeeId) ?? null;
  const drawerOpen = drawer === "new-user" || drawer === "edit-user";

  return (
    <AdminShell currentSection="tenants" adminEmail={admin.email}>
      <FlashNotice error={error} message={message} />

      <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,245,212,0.16),_transparent_34%),linear-gradient(135deg,_rgba(56,189,248,0.1),_rgba(22,27,34,0.96))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href={`/admin/tenants/${tenantId}`} className="text-sm text-[var(--accent)]">
              Voltar para o tenant
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.28em] text-white/45">Usuários do tenant</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">{preview.companyProfile?.trade_name ?? preview.tenant.name}</h1>
            <p className="mt-2 text-sm text-white/58">Lista operacional da equipe cadastrada no tenant.</p>
          </div>

          <Link
            href={`/admin/tenants/${tenantId}/users?drawer=new-user`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 text-sm font-medium text-[var(--accent)]"
          >
            Adicionar usuário
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
        <div className="grid gap-3">
          {preview.employees.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/58">
              Nenhum usuário cadastrado neste tenant.
            </div>
          ) : (
            preview.employees.map((employee) => (
              <Link
                key={employee.id}
                href={`/admin/tenants/${tenantId}/users?drawer=edit-user&employee_id=${employee.id}`}
                className="rounded-[22px] border border-white/10 bg-black/15 p-4 transition hover:border-[var(--accent)]/40 hover:bg-black/25"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px_120px] md:items-center">
                  <div>
                    <p className="text-base font-semibold text-white">{employee.name}</p>
                  </div>
                  <p className="text-sm text-white/68">{employee.email ?? "Sem e-mail"}</p>
                  <p className="text-sm text-white/68">{employee.role_label}</p>
                  <span className="rounded-full border border-white/10 px-3 py-2 text-center text-xs text-white/75">
                    {employee.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {drawerOpen ? (
        <section className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="max-h-[92vh] w-full max-w-[1240px] overflow-y-auto rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_55%),rgba(22,27,34,0.98)] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Usuários do tenant</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selectedEmployee ? "Editar usuário" : "Adicionar usuário"}</h2>
              </div>
              <Link href={`/admin/tenants/${tenantId}/users`} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                Fechar
              </Link>
            </div>

            <div className="mt-6">
              <AdminTenantEmployeeForm tenantId={tenantId} employee={selectedEmployee} formAction={saveTenantEmployeeByAdminAction} />
            </div>

            {selectedEmployee ? (
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <form action={setTenantEmployeeStateByAdminAction}>
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <input type="hidden" name="employee_id" value={selectedEmployee.id} />
                  <input type="hidden" name="is_active" value={selectedEmployee.is_active ? "false" : "true"} />
                  <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                    {selectedEmployee.is_active ? "Inativar usuário" : "Reativar usuário"}
                  </button>
                </form>

                <Link
                  href={`/admin/tenants/${tenantId}/users?drawer=new-user`}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82"
                >
                  Novo usuário
                </Link>

                <form action={deleteTenantEmployeeByAdminAction}>
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <input type="hidden" name="employee_id" value={selectedEmployee.id} />
                  <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 text-sm text-rose-100">
                    Excluir usuário
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
