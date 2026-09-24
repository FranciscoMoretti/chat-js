import type { UIMessage, UIMessageStreamWriter } from "ai";
import { z } from "zod";

import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import type { AppModelId } from "./app-models";

export const toolNameSchema = z.enum([
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

export type ToolName = z.infer<typeof toolNameSchema>;

export const frontendToolsSchema = z.enum([
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

export type UiToolName = z.infer<typeof frontendToolsSchema>;

export type SelectedModelCounts = Partial<Record<AppModelId, number>>;
export type SelectedModelValue = AppModelId | SelectedModelCounts;

export const isSelectedModelCounts = (
  value: unknown
): value is SelectedModelCounts => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  if (Object.keys(value).length === 0) {
    return false;
  }

  return Object.entries(value).every(
    ([modelId, count]) =>
      typeof modelId === "string" &&
      typeof count === "number" &&
      Number.isInteger(count) &&
      count > 0
  );
};

export const isSelectedModelValue = (
  value: unknown
): value is SelectedModelValue =>
  typeof value === "string" || isSelectedModelCounts(value);

export const getPrimarySelectedModelId = (
  selectedModel: SelectedModelValue | null | undefined
): AppModelId | null => {
  if (!selectedModel) {
    return null;
  }
  if (typeof selectedModel === "string") {
    return selectedModel;
  }
  const [firstSelectedModelId] = Object.entries(selectedModel).find(
    ([, count]) => typeof count === "number" && count > 0
  ) ?? [null];
  return firstSelectedModelId as AppModelId | null;
};

export const expandSelectedModelValue = (
  selectedModel: SelectedModelValue
): AppModelId[] => {
  if (typeof selectedModel === "string") {
    return [selectedModel];
  }
  const expanded: AppModelId[] = [];
  for (const [modelId, count] of Object.entries(selectedModel)) {
    if (!(typeof count === "number" && Number.isInteger(count) && count > 0)) {
      continue;
    }
    for (let index = 0; index < count; index += 1) {
      expanded.push(modelId as AppModelId);
    }
  }
  return expanded;
};

type PlatformMessage = UIMessage<unknown, { researchUpdate: ResearchUpdate }>;

export type StreamWriter = UIMessageStreamWriter<PlatformMessage>;
