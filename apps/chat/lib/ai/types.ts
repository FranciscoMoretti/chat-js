import type { AppModelId } from "./app-models";
import { z } from "zod";

const toolNameSchema = z.enum([
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
  "readDocument",
  "webSearch",
  "codeExecution",
  "generateImage",
  "generateVideo",
  "deepResearch",
]);

type ToolName = z.infer<typeof toolNameSchema>;

const frontendToolsSchema = z.enum([
  "webSearch",
  "deepResearch",
  "generateImage",
  "generateVideo",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
]);

type UiToolName = z.infer<typeof frontendToolsSchema>;

type SelectedModelCounts = Readonly<Partial<Record<AppModelId, number>>>;

type SelectedModelValue = AppModelId | SelectedModelCounts;

const isSelectedModelCounts = (
  value: unknown
): value is SelectedModelCounts => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  if (Object.keys(value).length === 0) {
    return false;
  }

  return Object.entries(value).every(
    ([modelId, count]: readonly [unknown, unknown]) =>
      typeof modelId === "string" &&
      typeof count === "number" &&
      Number.isInteger(count) &&
      count > 0
  );
};

const isSelectedModelValue = (value: unknown): value is SelectedModelValue =>
  typeof value === "string" || isSelectedModelCounts(value);

const getPrimarySelectedModelId = (
  selectedModel: SelectedModelValue | null | undefined
): AppModelId | null => {
  if (
    selectedModel === null ||
    !(typeof selectedModel === "string" || typeof selectedModel === "object") ||
    (typeof selectedModel === "string" && selectedModel.length === 0)
  ) {
    return null;
  }
  if (typeof selectedModel === "string") {
    return selectedModel;
  }
  const [firstSelectedModelId] = Object.entries(selectedModel).find(
    ([, count]: readonly [string, number | undefined]) =>
      typeof count === "number" && count > 0
  ) ?? [null];
  return firstSelectedModelId;
};

const expandSelectedModelValue = (
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
export {
  expandSelectedModelValue,
  frontendToolsSchema,
  getPrimarySelectedModelId,
  isSelectedModelCounts,
  isSelectedModelValue,
  toolNameSchema,
};
export type { SelectedModelCounts, SelectedModelValue, ToolName, UiToolName };
