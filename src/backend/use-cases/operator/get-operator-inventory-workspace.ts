import "server-only";
import { requireOperator } from "@/backend/auth/guards";
import {
  listInventoryItemsByTenant,
  listInventoryShelvesByTenant,
  listRecentInventoryMovementsByTenant,
} from "@/backend/repos/inventory-repo";
import { assertOperatorInventoryEnabled } from "@/backend/use-cases/operator/inventory-access";

export async function getOperatorInventoryWorkspaceUseCase(options?: {
  selectedShelfId?: string | null;
  pendingBarcode?: string | null;
  pendingQuantity?: string | null;
}) {
  const context = await requireOperator();
  await assertOperatorInventoryEnabled(context.tenantId);

  const [shelves, items, recentMovements] = await Promise.all([
    listInventoryShelvesByTenant(context.tenantId),
    listInventoryItemsByTenant(context.tenantId),
    listRecentInventoryMovementsByTenant(context.tenantId, 12),
  ]);

  const shelfSummaries = shelves.map((shelf) => {
    const shelfItems = items.filter((item) => item.shelf_id === shelf.id);
    const totalQuantity = shelfItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

    return {
      ...shelf,
      itemCount: shelfItems.length,
      totalQuantity,
    };
  });

  const selectedShelf = shelfSummaries.find((shelf) => shelf.id === options?.selectedShelfId) ?? shelfSummaries[0] ?? null;
  const selectedItems = selectedShelf ? items.filter((item) => item.shelf_id === selectedShelf.id) : [];
  const lowStockCount = items.filter((item) => Number(item.quantity ?? 0) <= Number(item.min_quantity ?? 0)).length;

  return {
    tenantId: context.tenantId,
    shelves: shelfSummaries,
    selectedShelf,
    selectedItems,
    barcodeCatalog: items
      .filter((item) => Boolean(item.barcode))
      .map((item) => ({
        name: item.name,
        barcode: item.barcode as string,
      })),
    recentMovements,
    pendingBarcode: options?.pendingBarcode?.trim() ?? "",
    pendingQuantity: options?.pendingQuantity?.trim() ?? "",
    stats: {
      shelvesCount: shelves.length,
      itemsCount: items.length,
      lowStockCount,
      movementCount: recentMovements.length,
    },
  };
}

export type OperatorInventoryWorkspace = Awaited<ReturnType<typeof getOperatorInventoryWorkspaceUseCase>>;
