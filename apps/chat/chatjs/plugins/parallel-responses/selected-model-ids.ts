import type { SelectedModelValue } from "@/lib/ai/types";
import type { AppModelId } from "@/lib/ai/app-models";

export const selectedModelIds = (
  selectedModel: SelectedModelValue
): AppModelId[] => {
  if (typeof selectedModel === "string") {
    return [selectedModel];
  }
  const expanded: AppModelId[] = [];
  for (const [modelId, count] of Object.entries(selectedModel)) {
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      for (let index = 0; index < count; index += 1) {
        expanded.push(modelId);
      }
    }
  }
  return expanded;
};

export const modelCounts = (modelIds: readonly string[]) => {
  const counts: Record<string, number> = {};
  for (const id of modelIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};
