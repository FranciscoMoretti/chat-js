import { z } from "zod";

import type { AppModelId } from "./app-models";

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

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-magic-numbers (#517): isSelectedModelCounts uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): isSelectedModelCounts accepts [modelId, count]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): isSelectedModelCounts intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const isSelectedModelCounts = (
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const isSelectedModelValue = (value: unknown): value is SelectedModelValue =>
  typeof value === "string" || isSelectedModelCounts(value);

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- no-magic-numbers (#517): getPrimarySelectedModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): getPrimarySelectedModelId accepts [, count]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): getPrimarySelectedModelId intentionally keeps the existing falsy-value behavior of selectedModel; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): getPrimarySelectedModelId preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const getPrimarySelectedModelId = (
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
  return firstSelectedModelId;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable no-continue, no-magic-numbers -- no-continue (#515): expandSelectedModelValue skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
no-magic-numbers (#517): expandSelectedModelValue uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const expandSelectedModelValue = (
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
      expanded.push(modelId);
    }
  }
  return expanded;
};
/* oxlint-enable no-continue, no-magic-numbers */
export {
  expandSelectedModelValue,
  frontendToolsSchema,
  getPrimarySelectedModelId,
  isSelectedModelCounts,
  isSelectedModelValue,
  toolNameSchema,
};
export type { SelectedModelCounts, SelectedModelValue, ToolName, UiToolName };
