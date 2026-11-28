import type { TurnModelPickerProps } from "@/chatjs/core/chat/turn-model-picker";
import type { SelectedCreation } from "@/lib/eve/creation-contract";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { SelectedModelValue } from "@/lib/ai/types";

export const selectedModelIds = (selection: SelectedModelValue): string[] =>
  typeof selection === "string" ? [selection] : [];

export const TurnModelPicker = (_props: TurnModelPickerProps): null => null;

export const editSelection = (
  _snapshot: LogicalChatSnapshot,
  _logicalMessageId: string
): undefined => undefined;
export const PendingResponseCards = (_props: {
  readonly operation: {
    readonly operationId: string;
    readonly modelIds: readonly string[];
  };
}): null => null;

export const operationModelSelection = (
  operation: ReadonlyNativeSurface<SelectedCreation>
) => ("modelId" in operation ? operation.modelId : undefined);
