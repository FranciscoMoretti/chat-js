import type { ModelData } from "@/lib/ai/model-data";
import { loadModelCatalog } from "@/lib/ai/model-catalog";

import { createToolUsage } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

const pricingForModel = async (
  modelId: string
): Promise<ModelData["pricing"] | undefined> => {
  const models = await loadModelCatalog();
  return models.find((model) => model.id === modelId)?.pricing;
};

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
/** Cost adapter with replaceable accounting methods and a deferred dollar total. */
interface EveToolCost {
  addAPICost: (name: string, costCents: number) => void;
  addImageCost: (
    modelId: string,
    count: number,
    usage: Readonly<TokenUsage>,
    source: string
  ) => void;
  addLLMCost: (
    modelId: string,
    tokens: Readonly<TokenUsage>,
    source: string
  ) => void;
  totalUsd: ToolUsage["totalUsd"];
}

/** Resolve provider usage before sealing a durable receipt; unknown pricing must not become free work.
 * @param {Readonly<ToolUsage>} usage Accounting session receiving immediate API cost and deferred provider-priced image/token charges.
 * @returns {EveToolCost} The existing tool cost adapter; totalUsd settles deferred charges and omits totals when reported pricing is incomplete.
 */
export const createEveToolCost = (
  usage: Readonly<ToolUsage> = createToolUsage()
): EveToolCost => ({
  addAPICost(_name: string, costCents: number): void {
    usage.addCostUsd(costCents / 100);
  },
  addImageCost(
    modelId: string,
    count: number,
    _usage: Readonly<TokenUsage>,
    _source: string
  ): void {
    usage.addDeferredCost(async () => {
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid generated image count.");
      }
      const pricing = await pricingForModel(modelId);
      const rate = Number(pricing?.image);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Image provider pricing is unavailable.");
      }
      return count * rate;
    });
  },
  addLLMCost(
    modelId: string,
    tokens: Readonly<TokenUsage>,
    _source: string
  ): void {
    usage.addDeferredCost(async () => {
      if (
        tokens.inputTokens === undefined ||
        tokens.outputTokens === undefined
      ) {
        throw new Error("Provider usage is unavailable.");
      }
      const pricing = await pricingForModel(modelId);
      return (
        tokenCost(tokens.inputTokens, pricing?.input) +
        tokenCost(tokens.outputTokens, pricing?.output)
      );
    });
  },
  totalUsd: usage.totalUsd.bind(usage),
});
