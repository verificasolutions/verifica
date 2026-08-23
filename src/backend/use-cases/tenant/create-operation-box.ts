import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createOperationBoxForTenant, listOperationBoxesByTenant, resequenceOperationBoxesForTenant } from "@/backend/repos/operation-boxes-repo";
import { isOperationBoxWithoutDeadline, normalizeOperationBoxTimeUnit, parseOperationBoxDurationToMinutes } from "@/backend/shared/operation-box-duration";
import { getOperationBoxCodePrefix, getOperationBoxColorToken } from "@/backend/shared/tenant-operational-profile";
import type { OperationBoxRecord } from "@/backend/types";

const validKinds: OperationBoxRecord["kind"][] = ["entry", "wash", "dry", "finish", "ready"];

export async function createOperationBoxUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as OperationBoxRecord["kind"];
  const sortOrderText = String(formData.get("sort_order") ?? "").trim();
  const sortOrderRaw = sortOrderText ? Number(sortOrderText) : Number.NaN;
  const rawSlaUnit = formData.get("sla_unit");
  const slaUnit = normalizeOperationBoxTimeUnit(rawSlaUnit);

  if (!name || !validKinds.includes(kind)) {
    redirect("/app/dashboard?section=adm&panel=settings&error=Preencha corretamente os dados do box.");
  }

  const existingBoxes = await listOperationBoxesByTenant(context.tenantId);
  const desiredPosition = Math.max(1, Math.min(existingBoxes.length + 1, Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : existingBoxes.length + 1));
  const slaMinutes = isOperationBoxWithoutDeadline(rawSlaUnit)
    ? null
    : parseOperationBoxDurationToMinutes(formData.get("sla_value") ?? formData.get("sla_minutes"), slaUnit);
  const codeInput = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = codeInput || `${getOperationBoxCodePrefix(kind)}-${String(existingBoxes.length + 1).padStart(2, "0")}`;
  const colorToken = String(formData.get("color_token") ?? "").trim() || getOperationBoxColorToken(kind);

  const created = await createOperationBoxForTenant({
    tenantId: context.tenantId,
    name,
    code,
    kind,
    sortOrder: existingBoxes.length + 1,
    slaMinutes,
    slaUnit,
    colorToken,
  });

  if (created.error || !created.record) {
    redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(created.error?.message ?? "Falha ao criar box.")}`);
  }

  const reorderedIds = [...existingBoxes.map((box) => box.id)];
  reorderedIds.splice(desiredPosition - 1, 0, created.record.id);

  const reorderError = await resequenceOperationBoxesForTenant({
    tenantId: context.tenantId,
    orderedBoxIds: reorderedIds,
  });

  if (reorderError) {
    redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(reorderError.message)}`);
  }
}
