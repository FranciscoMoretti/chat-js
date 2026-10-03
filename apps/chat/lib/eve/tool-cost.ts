/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/active-gateway"; "../ai/to-model-data"; "../credits/cost-accumulator" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { getActiveGateway } from "../ai/active-gateway";
import { toModelData } from "../ai/to-model-data";
import type { UsageInfo } from "../credits/cost-accumulator";
import { createToolUsage } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable no-magic-numbers, no-ternary, no-undefined --
 * no-magic-numbers (#517): tokenCost uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): tokenCost derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): tokenCost uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const tokenCost = (
  tokens: number | undefined,
  price: string | undefined
): number => {
  if (tokens === undefined || tokens === 0) {
    return 0;
  }
  const rate =
    price === undefined || price.trim() === "" ? Number.NaN : Number(price);
  if (
    !Number.isFinite(tokens) ||
    tokens < 0 ||
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    throw new Error("Provider usage pricing is unavailable.");
  }
  return tokens * rate;
};
/* oxlint-enable no-magic-numbers, no-ternary, no-undefined */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named createEveToolCost API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): createEveToolCost remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): createEveToolCost's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createEveToolCost's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): createEveToolCost keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createEveToolCost uses 100, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): createEveToolCost uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): createEveToolCost sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): createEveToolCost handles optional models.find((model) => model.id === modelId)?.pricing?.image; models.find((model) => model.id === modelId)?.pricing; pricing?.input; pricing?.output without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep createEveToolCost's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep createEveToolCost's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): createEveToolCost accepts usage: ToolUsage = createToolUsage(); _usage: UsageInfo; model; tokens: UsageInfo; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Resolve provider usage before sealing a durable receipt; unknown pricing must not become free work. */
export const createEveToolCost = (usage: ToolUsage = createToolUsage()) => ({
  addAPICost(_name: string, costCents: number): void {
    usage.addCostUsd(costCents / 100);
  },
  addImageCost(
    modelId: string,
    count: number,
    _usage: UsageInfo,
    _source: string
  ): void {
    usage.addDeferredCost(async () => {
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid generated image count.");
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const models = fetchedModels.map((model) => toModelData(model));
      const rate = Number(
        models.find((model) => model.id === modelId)?.pricing?.image
      );
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Image provider pricing is unavailable.");
      }
      return count * rate;
    });
  },
  addLLMCost(modelId: string, tokens: UsageInfo, _source: string): void {
    usage.addDeferredCost(async () => {
      if (
        tokens.inputTokens === undefined ||
        tokens.outputTokens === undefined
      ) {
        throw new Error("Provider usage is unavailable.");
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const models = fetchedModels.map((model) => toModelData(model));
      const pricing = models.find((model) => model.id === modelId)?.pricing;
      return (
        tokenCost(tokens.inputTokens, pricing?.input) +
        tokenCost(tokens.outputTokens, pricing?.output)
      );
    });
  },
  totalUsd: usage.totalUsd.bind(usage),
});
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
