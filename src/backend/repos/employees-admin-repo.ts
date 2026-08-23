/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmployeeRecord } from "@/backend/types";

const employeeFields = `
  id, tenant_id, name, phone, email, contact_phone, cpf, birth_date, postal_code, street,
  street_number, complement, neighborhood, city, state, internal_code, role_label,
  can_access_system, payment_type, payment_value, is_active, is_present, auth_user_id
`;

function mapEmployee(row: any): EmployeeRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    phone: row.phone ?? null,
    email: row.email ?? null,
    contact_phone: row.contact_phone ?? null,
    cpf: row.cpf ?? null,
    birth_date: row.birth_date ?? null,
    postal_code: row.postal_code ?? null,
    street: row.street ?? null,
    street_number: row.street_number ?? null,
    complement: row.complement ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    internal_code: row.internal_code ?? null,
    role_label: row.role_label,
    can_access_system: Boolean(row.can_access_system),
    payment_type: row.payment_type,
    payment_value: Number(row.payment_value ?? 0),
    is_active: Boolean(row.is_active),
    is_present: Boolean(row.is_present),
    auth_user_id: row.auth_user_id ?? null,
  };
}

export async function listTenantEmployeesAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("employees")
    .select(employeeFields)
    .eq("tenant_id", tenantId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  return ((data ?? []) as any[]).map(mapEmployee);
}

export async function getTenantEmployeeByIdAdmin(tenantId: string, employeeId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("employees")
    .select(employeeFields)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .maybeSingle();

  return data ? mapEmployee(data) : null;
}

export async function getEmployeeByAuthUserAdmin(userId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("employees")
    .select(employeeFields)
    .eq("auth_user_id", userId)
    .maybeSingle();

  return data ? mapEmployee(data) : null;
}

export async function createTenantEmployeeAdmin(input: {
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  contactPhone: string | null;
  cpf: string | null;
  birthDate: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  internalCode: string | null;
  roleLabel: string;
  canAccessSystem: boolean;
  paymentType: "daily" | "commission" | "fixed";
  paymentValue: number;
  authUserId?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("employees").insert({
    tenant_id: input.tenantId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    contact_phone: input.contactPhone,
    cpf: input.cpf,
    birth_date: input.birthDate,
    postal_code: input.postalCode,
    street: input.street,
    street_number: input.streetNumber,
    complement: input.complement,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    internal_code: input.internalCode,
    role_label: input.roleLabel,
    can_access_system: input.canAccessSystem,
    payment_type: input.paymentType,
    payment_value: input.paymentValue,
    auth_user_id: input.authUserId ?? null,
    is_active: true,
    is_present: false,
  });

  return error as { message: string } | null;
}

export async function updateTenantEmployeeAdmin(input: {
  tenantId: string;
  employeeId: string;
  name: string;
  phone: string | null;
  email: string | null;
  contactPhone: string | null;
  cpf: string | null;
  birthDate: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  internalCode: string | null;
  roleLabel: string;
  canAccessSystem: boolean;
  paymentType: "daily" | "commission" | "fixed";
  paymentValue: number;
  authUserId?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("employees")
    .update({
      name: input.name,
      phone: input.phone,
      email: input.email,
      contact_phone: input.contactPhone,
      cpf: input.cpf,
      birth_date: input.birthDate,
      postal_code: input.postalCode,
      street: input.street,
      street_number: input.streetNumber,
      complement: input.complement,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      internal_code: input.internalCode,
      role_label: input.roleLabel,
      can_access_system: input.canAccessSystem,
      payment_type: input.paymentType,
      payment_value: input.paymentValue,
      auth_user_id: input.authUserId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.employeeId);

  return error as { message: string } | null;
}

export async function setTenantEmployeeActiveStateAdmin(input: {
  tenantId: string;
  employeeId: string;
  isActive: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("employees")
    .update({
      is_active: input.isActive,
      is_present: input.isActive ? undefined : false,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.employeeId);

  return error as { message: string } | null;
}

export async function deleteTenantEmployeeAdmin(tenantId: string, employeeId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("employees")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", employeeId);

  return error as { message: string } | null;
}
