/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserByEmailAdmin(email: string) {
  const admin = createSupabaseAdminClient();
  const result = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return result.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createAuthUserAdmin(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const admin = createSupabaseAdminClient();
  return admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
    },
  });
}

export async function updateAuthUserAdmin(input: {
  userId: string;
  password?: string;
  fullName: string;
  email?: string;
}) {
  const admin = createSupabaseAdminClient();
  const payload: {
    password?: string;
    email?: string;
    user_metadata: {
      full_name: string;
    };
  } = {
    user_metadata: {
      full_name: input.fullName,
    },
  };

  if (input.password) {
    payload.password = input.password;
  }

  if (input.email) {
    payload.email = input.email;
  }

  return admin.auth.admin.updateUserById(input.userId, payload);
}

export async function upsertProfileAdmin(input: {
  userId: string;
  fullName: string;
  phone: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("profiles").upsert({
    id: input.userId,
    full_name: input.fullName,
    phone: input.phone,
  });
  return error as { message: string } | null;
}
