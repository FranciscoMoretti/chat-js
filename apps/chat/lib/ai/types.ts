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

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): isSelectedModelCounts uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
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
/* oxlint-enable no-magic-numbers */

const isSelectedModelValue = (value: unknown): value is SelectedModelValue =>
  typeof value === "string" || isSelectedModelCounts(value);

/* oxlint-disable no-magic-numbers, unicorn/no-null -- no-magic-numbers (#517): getPrimarySelectedModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/no-null (#570): getPrimarySelectedModelId preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
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
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): expandSelectedModelValue uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (expandSelectedModelValue, frontendToolsSchema, getPrimarySelectedModelId, isSelectedModelCounts, isSelectedModelValue, toolNameSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers */
export {
  expandSelectedModelValue,
  frontendToolsSchema,
  getPrimarySelectedModelId,
  isSelectedModelCounts,
  isSelectedModelValue,
  toolNameSchema,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SelectedModelCounts, SelectedModelValue, ToolName, UiToolName); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { SelectedModelCounts, SelectedModelValue, ToolName, UiToolName };
/* oxlint-enable import/no-named-export */
