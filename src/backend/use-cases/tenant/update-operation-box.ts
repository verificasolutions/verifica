import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listOperationBoxesByTenant, resequenceOperationBoxesForTenant, updateOperationBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { isOperationBoxWithoutDeadline, normalizeOperationBoxTimeUnit, parseOperationBoxDurationToMinutes } from "@/backend/shared/operation-box-duration";
import { getOperationBoxCodePrefix, getOperationBoxColorToken } from "@/backend/shared/tenant-operational-profile";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";
import type { OperationBoxRecord } from "@/backend/types";

const validKinds: OperationBoxRecord["kind"][] = ["entry", "wash", "dry", "finish", "ready"];

export async function updateOperationBoxUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const boxId = String(formData.get("box_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as OperationBoxRecord["kind"];
  const sortOrderText = String(formData.get("sort_order") ?? "").trim();
  const sortOrderRaw = sortOrderText ? Number(sortOrderText) : Number.NaN;
  const rawSlaUnit = formData.get("sla_unit");
  const slaUnit = normalizeOperationBoxTimeUnit(rawSlaUnit);
  const isActive = readCheckboxValue(formData, "is_active");

  if (!boxId || !name || !validKinds.includes(kind)) {
    redirect("/app/dashboard?section=adm&panel=settings&error=Dados invalidos para atualizar o box.");
  }

  const existingBoxes = await listOperationBoxesByTenant(context.tenantId);
  const desiredPosition = Math.max(1, Math.min(existingBoxes.length, Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : 1));
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || `${getOperationBoxCodePrefix(kind)}-01`;
  const colorToken = String(formData.get("color_token") ?? "").trim() || getOperationBoxColorToken(kind);

  const error = await updateOperationBoxForTenant({
    tenantId: context.tenantId,
    boxId,
    name,
    code,
    kind,
    sortOrder: desiredPosition,
    slaMinutes: isOperationBoxWithoutDeadline(rawSlaUnit)
      ? null
      : parseOperationBoxDurationToMinutes(formData.get("sla_value") ?? formData.get("sla_minutes"), slaUnit),
    slaUnit,
    colorToken,
    isActive,
  });

  if (error) {
    redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(error.message)}`);
  }

  const reorderedIds = existingBoxes.filter((box) => box.id !== boxId).map((box) => box.id);
  reorderedIds.splice(desiredPosition - 1, 0, boxId);

  const reorderError = await resequenceOperationBoxesForTenant({
    tenantId: context.tenantId,
    orderedBoxIds: reorderedIds,
  });

  if (reorderError) {
    redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(reorderError.message)}`);
  }
}
