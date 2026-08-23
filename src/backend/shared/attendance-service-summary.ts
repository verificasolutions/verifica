import type { AttendanceRecord, AttendanceServiceItemRecord } from "@/backend/types";

function uniqueNames(items: Array<{ name: string | null | undefined }>) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const item of items) {
    const name = (item.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

export function summarizeAttendanceServiceItems(items: AttendanceServiceItemRecord[] | null | undefined) {
  const names = uniqueNames(items ?? []);

  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + mais ${names.length - 1}`;
}

export function resolveAttendanceServiceDisplayName(attendance: {
  services?: { name?: string | null } | null;
  service_label?: string | null;
  service_summary?: string | null;
  service_items?: AttendanceServiceItemRecord[] | null;
}) {
  return (
    attendance.service_summary ??
    summarizeAttendanceServiceItems(attendance.service_items) ??
    attendance.service_label ??
    attendance.services?.name ??
    "Orçamento / diagnóstico"
  );
}

export function resolveAttendancePrimaryServiceName(attendance: Pick<AttendanceRecord, "services" | "service_label" | "service_summary" | "service_items">) {
  const primaryItem = [...(attendance.service_items ?? [])]
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.sort_order - b.sort_order;
    })[0];

  return primaryItem?.name?.trim() || resolveAttendanceServiceDisplayName(attendance);
}
