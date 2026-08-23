import { shouldSkipBoxKindForService } from "@/backend/shared/service-flow";
import type { OperationBoxKind, OperationBoxRecord } from "@/backend/types";

type QueueLikeItem = {
  id: string;
  current_box_id?: string | null;
  status?: string | null;
  queue_position?: number | null;
};

function activeBoxesSorted(boxes: OperationBoxRecord[]) {
  return [...boxes].filter((box) => box.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

function nextKindSequence(boxes: OperationBoxRecord[], serviceName: string | null | undefined) {
  const kinds: OperationBoxKind[] = [];

  for (const box of activeBoxesSorted(boxes)) {
    if (box.kind === "entry") continue;
    if (shouldSkipBoxKindForService(box.kind, serviceName)) continue;
    if (!kinds.includes(box.kind)) {
      kinds.push(box.kind);
    }
  }

  return kinds;
}

function occupancyByBox(boxes: OperationBoxRecord[], queue: QueueLikeItem[]) {
  const counts = new Map<string, number>();
  for (const box of boxes) counts.set(box.id, 0);

  for (const item of queue) {
    if (!item.current_box_id) continue;
    counts.set(item.current_box_id, (counts.get(item.current_box_id) ?? 0) + 1);
  }

  return counts;
}

function chooseLeastLoadedBox(candidates: OperationBoxRecord[], queue: QueueLikeItem[]) {
  const occupancy = occupancyByBox(candidates, queue);

  return [...candidates].sort((a, b) => {
    const aCount = occupancy.get(a.id) ?? 0;
    const bCount = occupancy.get(b.id) ?? 0;
    if (aCount !== bCount) return aCount - bCount;
    return a.sort_order - b.sort_order;
  })[0] ?? null;
}

export function resolveEntryBox(boxes: OperationBoxRecord[]) {
  return activeBoxesSorted(boxes).find((box) => box.kind === "entry") ?? activeBoxesSorted(boxes)[0] ?? null;
}

export function resolveNextBoxForFlow(input: {
  boxes: OperationBoxRecord[];
  queue: QueueLikeItem[];
  currentBoxId?: string | null;
  serviceName?: string | null;
}) {
  const boxes = activeBoxesSorted(input.boxes);
  if (boxes.length === 0) return null;

  const currentBox = input.currentBoxId ? boxes.find((box) => box.id === input.currentBoxId) ?? null : null;
  const sequence = nextKindSequence(boxes, input.serviceName);

  if (!currentBox) {
    const firstKind = sequence[0];
    if (!firstKind) return null;
    return chooseLeastLoadedBox(
      boxes.filter((box) => box.kind === firstKind),
      input.queue,
    );
  }

  if (currentBox.kind === "ready") {
    return null;
  }

  const currentKindIndex = sequence.findIndex((kind) => kind === currentBox.kind);
  const nextKind = currentKindIndex >= 0 ? sequence[currentKindIndex + 1] ?? null : sequence[0] ?? null;
  if (!nextKind) return null;

  return chooseLeastLoadedBox(
    boxes.filter((box) => box.kind === nextKind),
    input.queue,
  );
}

export function listSelectableDestinationBoxes(input: {
  boxes: OperationBoxRecord[];
  currentBoxId?: string | null;
}) {
  return activeBoxesSorted(input.boxes).filter((box) => box.id !== input.currentBoxId);
}
