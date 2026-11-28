import type { LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { SelectedCreation } from "@/lib/eve/creation-contract";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { modelCounts } from "./selected-model-ids";
import { logicalResponseSlots } from "./logical-response-slots";

export { selectedModelIds } from "./selected-model-ids";
export { ParallelResponseModelPicker as TurnModelPicker } from "./parallel-response-picker";
export { EveOptimisticResponseGroup as PendingResponseCards } from "./eve-optimistic-response-group";
export const operationModelSelection = (
  operation: ReadonlyNativeSurface<SelectedCreation>
) =>
  "modelIds" in operation ? modelCounts(operation.modelIds) : operation.modelId;

export const editSelection = (
  snapshot: LogicalChatSnapshot,
  logicalMessageId: string
) => {
  const group = logicalResponseSlots(snapshot, logicalMessageId);
  const modelIds = group?.slots.map((slot) => slot.modelId);
  return modelIds !== undefined && modelIds.every((id) => id !== null)
    ? modelCounts(modelIds)
    : undefined;
};
