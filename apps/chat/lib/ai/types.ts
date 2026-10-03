import { z } from "zod";

import type { AppModelId } from "./app-models";

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): toolNameSchema stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named toolNameSchema API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): ToolName stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ToolName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ToolName = z.infer<typeof toolNameSchema>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): frontendToolsSchema stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named frontendToolsSchema API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): UiToolName stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named UiToolName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type UiToolName = z.infer<typeof frontendToolsSchema>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): SelectedModelCounts stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named SelectedModelCounts API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type SelectedModelCounts = Partial<Record<AppModelId, number>>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): SelectedModelValue stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named SelectedModelValue API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type SelectedModelValue = AppModelId | SelectedModelCounts;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): isSelectedModelCounts stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isSelectedModelCounts API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): isSelectedModelCounts uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): isSelectedModelCounts accepts [modelId, count]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): isSelectedModelCounts intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): isSelectedModelValue stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isSelectedModelValue API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const isSelectedModelValue = (
  value: unknown
): value is SelectedModelValue =>
  typeof value === "string" || isSelectedModelCounts(value);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/group-exports (#523): getPrimarySelectedModelId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getPrimarySelectedModelId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getPrimarySelectedModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): getPrimarySelectedModelId accepts [, count]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getPrimarySelectedModelId intentionally keeps the existing falsy-value behavior of selectedModel; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): getPrimarySelectedModelId preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Selection keys originate from the supported model catalog; preserving the model-ID union requires a validated-selection API migration.
  return firstSelectedModelId as AppModelId | null;
};
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, no-continue, no-magic-numbers  --
 * import/group-exports (#523): expandSelectedModelValue stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named expandSelectedModelValue API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-continue (#515): expandSelectedModelValue skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): expandSelectedModelValue uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Selection keys originate from the supported model catalog; preserving the model-ID union requires a validated-selection API migration.
      expanded.push(modelId as AppModelId);
    }
  }
  return expanded;
};
/* oxlint-enable import/group-exports, no-continue, no-magic-numbers */
