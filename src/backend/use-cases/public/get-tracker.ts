import "server-only";
import { getAttendancePublicStatusByCode } from "@/backend/repos/attendance-public-repo";

export async function getPublicTrackerUseCase(publicCode: string) {
  const tracker = await getAttendancePublicStatusByCode(publicCode);
  return tracker;
}
