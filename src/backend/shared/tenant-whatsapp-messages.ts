import "server-only";
import type { TenantSettingsRecord } from "@/backend/types";

export type TenantMessageStage = "queue" | "washing" | "finishing" | "ready";

export function readCheckboxValue(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).toLowerCase())
    .includes("true");
}

export function isCustomerMessagingUnlocked(settings: TenantSettingsRecord | null) {
  return Boolean(settings?.evolution_enabled && settings?.customer_messages_enabled);
}

export function isTenantMessageStageEnabled(settings: TenantSettingsRecord | null, stage: TenantMessageStage) {
  if (!isCustomerMessagingUnlocked(settings)) {
    return false;
  }

  if (stage === "queue") {
    return settings?.queue_entry_message_enabled ?? true;
  }

  if (stage === "washing") {
    return settings?.wash_start_message_enabled ?? false;
  }

  if (stage === "finishing") {
    return settings?.finishing_message_enabled ?? false;
  }

  return settings?.ready_message_enabled ?? true;
}
