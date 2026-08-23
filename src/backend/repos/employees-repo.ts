import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeRecord } from "@/backend/types";

const employeeFields =
  "id, tenant_id, name, phone, email, contact_phone, cpf, birth_date, postal_code, street, street_number, complement, neighborhood, city, state, internal_code, role_label, can_access_system, payment_type, payment_value, is_active, is_present, auth_user_id";

export async function listEmployeesByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("employees")
    .select(employeeFields)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return ((data ?? []) as EmployeeRecord[]).map((item) => ({
    ...item,
    payment_value: Number(item.payment_value ?? 0),
  }));
}

export async function createEmployeeForTenant(input: {
  tenantId: string;
  name: string;
  phone: string | null;
  email?: string | null;
  contactPhone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  internalCode?: string | null;
  roleLabel: string;
  canAccessSystem: boolean;
  paymentType: "daily" | "commission" | "fixed";
  paymentValue: number;
  authUserId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").insert({
    tenant_id: input.tenantId,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    contact_phone: input.contactPhone ?? null,
    cpf: input.cpf ?? null,
    birth_date: input.birthDate ?? null,
    postal_code: input.postalCode ?? null,
    street: input.street ?? null,
    street_number: input.streetNumber ?? null,
    complement: input.complement ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    internal_code: input.internalCode ?? null,
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

export async function toggleEmployeePresence(tenantId: string, employeeId: string, isPresent: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({ is_present: isPresent })
    .eq("tenant_id", tenantId)
    .eq("id", employeeId);

  return error as { message: string } | null;
}

export async function getEmployeeByAuthUser(tenantId: string, authUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("employees")
    .select(employeeFields)
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as EmployeeRecord | null) ?? null;
}

export async function getEmployeeById(tenantId: string, employeeId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("employees")
    .select(employeeFields)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .eq("is_active", true)
    .maybeSingle();

  return data
    ? ({
        ...(data as EmployeeRecord),
        payment_value: Number((data as EmployeeRecord).payment_value ?? 0),
      } as EmployeeRecord)
    : null;
}

export async function updateEmployeeForTenant(input: {
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
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

export async function setEmployeeActiveStateForTenant(input: {
  tenantId: string;
  employeeId: string;
  isActive: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
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
