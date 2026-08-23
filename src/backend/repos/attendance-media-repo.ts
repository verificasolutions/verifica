import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceMediaKind, AttendanceMediaRecord } from "@/backend/types";

export const ATTENDANCE_MEDIA_BUCKET = "attendance-media";

export async function ensureAttendanceMediaBucket() {
  const admin = createSupabaseAdminClient();
  const buckets = await admin.storage.listBuckets();
  if (buckets.data?.some((bucket) => bucket.name === ATTENDANCE_MEDIA_BUCKET)) {
    return null;
  }

  const created = await admin.storage.createBucket(ATTENDANCE_MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  return created.error ? { message: created.error.message } : null;
}

export async function uploadAttendanceMediaFileUpsert(input: {
  path: string;
  contentType: string;
  bytes: Buffer;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).upload(input.path, input.bytes, {
    contentType: input.contentType,
    upsert: true,
  });

  return error ? { message: error.message } : null;
}

export async function uploadAttendanceMediaFile(input: {
  path: string;
  contentType: string;
  bytes: Buffer;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).upload(input.path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });

  return error ? { message: error.message } : null;
}

export async function createAttendanceMediaRecord(input: {
  tenantId: string;
  attendanceId: string;
  boxId: string | null;
  kind: AttendanceMediaKind;
  filePath: string;
  mimeType: string;
  caption: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_media").insert({
    tenant_id: input.tenantId,
    attendance_id: input.attendanceId,
    box_id: input.boxId,
    kind: input.kind,
    file_path: input.filePath,
    mime_type: input.mimeType,
    caption: input.caption,
  });

  return error ? { message: error.message } : null;
}

export async function listAttendanceMediaByAttendance(attendanceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_media")
    .select("id, tenant_id, attendance_id, box_id, uploaded_by, kind, file_path, mime_type, caption, created_at")
    .eq("attendance_id", attendanceId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as AttendanceMediaRecord[];
  if (rows.length === 0) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const signed = await Promise.all(
    rows.map(async (row) => {
      const result = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(row.file_path, 3600);
      return {
        ...row,
        signed_url: result.data?.signedUrl ?? null,
      };
    }),
  );

  return signed;
}

export async function listAttendanceMediaByAttendances(attendanceIds: string[]) {
  if (attendanceIds.length === 0) {
    return new Map<string, AttendanceMediaRecord[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_media")
    .select("id, tenant_id, attendance_id, box_id, uploaded_by, kind, file_path, mime_type, caption, created_at")
    .in("attendance_id", attendanceIds)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as AttendanceMediaRecord[];
  const admin = createSupabaseAdminClient();
  const signedRows = await Promise.all(
    rows.map(async (row) => {
      const result = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(row.file_path, 3600);
      return {
        ...row,
        signed_url: result.data?.signedUrl ?? null,
      };
    }),
  );

  const grouped = new Map<string, AttendanceMediaRecord[]>();
  for (const row of signedRows) {
    const bucket = grouped.get(row.attendance_id) ?? [];
    bucket.push(row);
    grouped.set(row.attendance_id, bucket);
  }

  return grouped;
}

export async function getLatestAttendanceMediaByKind(attendanceId: string, kind: AttendanceMediaKind) {
  const media = await listAttendanceMediaByAttendance(attendanceId);
  return media.find((item) => item.kind === kind) ?? null;
}

export async function getAttendanceMediaRecordById(tenantId: string, mediaId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_media")
    .select("id, tenant_id, attendance_id, box_id, uploaded_by, kind, file_path, mime_type, caption, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", mediaId)
    .maybeSingle();

  return (data as AttendanceMediaRecord | null) ?? null;
}

export async function createAttendanceMediaSignedUrl(filePath: string, expiresInSeconds = 3600) {
  const admin = createSupabaseAdminClient();
  const result = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(filePath, expiresInSeconds);
  return result.data?.signedUrl ?? null;
}
