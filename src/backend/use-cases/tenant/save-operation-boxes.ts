import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listOperationBoxesByTenant, resequenceOperationBoxesForTenant, updateOperationBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { isOperationBoxWithoutDeadline, normalizeOperationBoxTimeUnit, parseOperationBoxDurationToMinutes } from "@/backend/shared/operation-box-duration";
import { getOperationBoxCodePrefix, getOperationBoxColorToken } from "@/backend/shared/tenant-operational-profile";
import type { OperationBoxRecord } from "@/backend/types";

const validKinds: OperationBoxRecord["kind"][] = ["entry", "wash", "dry", "finish", "ready"];

function redirectInvalid() {
  redirect("/app/dashboard?section=adm&panel=settings&error=Dados invalidos para atualizar os boxes.#boxes-cadastrados");
}

function readDynamicCheckboxValue(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).toLowerCase())
    .includes("true");
}

export async function saveOperationBoxesUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const existingBoxes = await listOperationBoxesByTenant(context.tenantId);

  if (existingBoxes.length === 0) {
    redirect("/app/dashboard?section=adm&panel=settings&error=Nenhum box encontrado.#boxes-cadastrados");
  }

  const desiredOrder = existingBoxes
    .map((box, index) => {
      const name = String(formData.get(`name__${box.id}`) ?? "").trim();
      const kind = String(formData.get(`kind__${box.id}`) ?? "").trim() as OperationBoxRecord["kind"];
      const sortOrderText = String(formData.get(`sort_order__${box.id}`) ?? "").trim();
      const sortOrderRaw = sortOrderText ? Number(sortOrderText) : Number.NaN;
      const rawSlaUnit = formData.get(`sla_unit__${box.id}`);
      const slaUnit = normalizeOperationBoxTimeUnit(rawSlaUnit);
      const code = String(formData.get(`code__${box.id}`) ?? "").trim().toUpperCase() || `${getOperationBoxCodePrefix(kind)}-${String(index + 1).padStart(2, "0")}`;
      const colorToken = String(formData.get(`color_token__${box.id}`) ?? "").trim() || getOperationBoxColorToken(kind);
      const isActive = readDynamicCheckboxValue(formData, `is_active__${box.id}`);

      if (!name || !validKinds.includes(kind)) {
        redirectInvalid();
      }

      const desiredPosition = Math.max(1, Math.min(existingBoxes.length, Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : box.sort_order));
      const slaMinutes = isOperationBoxWithoutDeadline(rawSlaUnit)
        ? null
        : parseOperationBoxDurationToMinutes(formData.get(`sla_value__${box.id}`) ?? formData.get(`sla_minutes__${box.id}`), slaUnit);

      return {
        id: box.id,
        currentOrder: box.sort_order,
        desiredPosition,
        payload: {
          tenantId: context.tenantId,
          boxId: box.id,
          name,
          code,
          kind,
          sortOrder: desiredPosition,
          slaMinutes,
          slaUnit,
          colorToken,
          isActive,
        },
      };
    })
    .sort((a, b) => {
      if (a.desiredPosition !== b.desiredPosition) return a.desiredPosition - b.desiredPosition;
      return a.currentOrder - b.currentOrder;
    });

  for (const item of desiredOrder) {
    const error = await updateOperationBoxForTenant(item.payload);
    if (error) {
      redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(error.message)}#boxes-cadastrados`);
    }
  }

  const reorderError = await resequenceOperationBoxesForTenant({
    tenantId: context.tenantId,
    orderedBoxIds: desiredOrder.map((item) => item.id),
  });

  if (reorderError) {
    redirect(`/app/dashboard?section=adm&panel=settings&error=${encodeURIComponent(reorderError.message)}#boxes-cadastrados`);
  }
}
