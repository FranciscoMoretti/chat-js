import { getActiveGateway } from "@/lib/ai/active-gateway";
import { toModelData } from "@/lib/ai/to-model-data";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UsageInfo } from "@/lib/credits/cost-accumulator";
/* oxlint-enable sort-imports */

import { createToolUsage } from "./tool-usage";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolUsage } from "./tool-usage";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): tokenCost uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): createEveToolCost's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createEveToolCost's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): createEveToolCost keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createEveToolCost uses 100, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): createEveToolCost uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
