import type { AiGatewayModel } from "@chat-js/gateways/models";

import { getActiveGateway } from "@/lib/ai/active-gateway";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UsageInfo } from "@/lib/credits/cost-accumulator";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { createToolUsage } from "./tool-usage";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolUsage } from "./tool-usage";
/* oxlint-enable sort-imports */

// Gateway records are Zod-parsed or generated literals; retain the selected pricing object while skipping an unused full ModelData projection.
const pricingForModel = (
  fetchedModels: ReadonlyNativeSurface<AiGatewayModel[]>,
  modelId: string
): ReadonlyNativeSurface<AiGatewayModel["pricing"]> | undefined =>
  // oxlint-disable-next-line oxc/no-optional-chaining -- An absent model has no pricing; keep the existing undefined result and return the selected model's original pricing object.
  fetchedModels.find((model) => model.id === modelId)?.pricing;

const tokenCost = (
  tokens: number | undefined,
  price: string | undefined
): number => {
  // oxlint-disable-next-line no-undefined, no-magic-numbers -- Absent or zero token usage contributes zero cost before provider-rate validation.
  if (tokens === undefined || tokens === 0) {
    // oxlint-disable-next-line no-magic-numbers -- No reported token work has zero cost.
    return 0;
  }
  const rate =
    // oxlint-disable-next-line no-undefined, no-ternary -- Provider rate absence must fail nonzero token pricing rather than become free work.; no-ternary: Keep rate as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    price === undefined || price.trim() === "" ? Number.NaN : Number(price);
  /* oxlint-disable no-magic-numbers -- Negative token counts/rates cannot produce a valid nonnegative usage charge. */
  if (
    !Number.isFinite(tokens) ||
    tokens < 0 ||
    !Number.isFinite(rate) ||
    rate < 0
  ) {
    throw new Error("Provider usage pricing is unavailable.");
  }
  /* oxlint-enable no-magic-numbers */
  return tokens * rate;
};
/** Cost adapter with replaceable accounting methods and a deferred dollar total. */
interface EveToolCost {
  /* oxlint-disable typescript/method-signature-style -- Preserve the adapter's existing method parameter variance; function-property signatures reject narrower caller-provided replacements accepted by the inferred methods. */
  addAPICost(name: string, costCents: number): void;
  addImageCost(
    modelId: string,
    count: number,
    usage: Readonly<UsageInfo>,
    source: string
  ): void;
  addLLMCost(
    modelId: string,
    tokens: Readonly<UsageInfo>,
    source: string
  ): void;
  /* oxlint-enable typescript/method-signature-style */
  totalUsd: ToolUsage["totalUsd"];
}

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createEveToolCost); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/** Resolve provider usage before sealing a durable receipt; unknown pricing must not become free work.
 * @param {Readonly<ToolUsage>} usage Accounting session receiving immediate API cost and deferred provider-priced image/token charges.
 * @returns {EveToolCost} The existing tool cost adapter; totalUsd settles deferred charges and omits totals when reported pricing is incomplete.
 */
export const createEveToolCost = (
  usage: Readonly<ToolUsage> = createToolUsage()
): EveToolCost => ({
  addAPICost(_name: string, costCents: number): void {
    // oxlint-disable-next-line no-magic-numbers -- API charges are reported in cents; convert to dollars for durable usage receipts.
    usage.addCostUsd(costCents / 100);
  },
  // oxlint-disable-next-line max-params -- Preserve the existing adapter callback parameters: model, image count, provider usage and source identity.
  addImageCost(
    modelId: string,
    count: number,
    _usage: Readonly<UsageInfo>,
    _source: string
  ): void {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve usage.addDeferredCost's awaited sequencing and rejected-Promise behavior. */
    usage.addDeferredCost(async () => {
      // oxlint-disable-next-line no-magic-numbers -- Generated image counts must be nonnegative integers.
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid generated image count.");
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const rate = Number(
        // oxlint-disable-next-line oxc/no-optional-chaining -- A model pricing entry can omit its image rate; Number(undefined) keeps that charge unavailable rather than free. The app guidance prefers optional chaining.
        pricingForModel(fetchedModels, modelId)?.image
      );
      // oxlint-disable-next-line no-magic-numbers -- Missing/negative image provider price is unavailable pricing, never free work.
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Image provider pricing is unavailable.");
      }
      return count * rate;
    });
    /* oxlint-enable oxc/no-async-await */
  },
  addLLMCost(
    modelId: string,
    tokens: Readonly<UsageInfo>,
    _source: string
  ): void {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve usage.addDeferredCost's awaited sequencing and rejected-Promise behavior. */
    usage.addDeferredCost(async () => {
      /* oxlint-disable no-undefined -- Both input and output token counts must be present before provider pricing; absence throws the established unavailable-usage failure. */
      if (
        tokens.inputTokens === undefined ||
        tokens.outputTokens === undefined
      ) {
        throw new Error("Provider usage is unavailable.");
      }
      /* oxlint-enable no-undefined */
      const fetchedModels = await getActiveGateway().fetchModels();
      const pricing = pricingForModel(fetchedModels, modelId);
      return (
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading input from pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        tokenCost(tokens.inputTokens, pricing?.input) +
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading output from pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        tokenCost(tokens.outputTokens, pricing?.output)
      );
    });
    /* oxlint-enable oxc/no-async-await */
  },
  totalUsd: usage.totalUsd.bind(usage),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
