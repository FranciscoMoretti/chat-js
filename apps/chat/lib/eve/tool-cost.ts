import { getActiveGateway } from "../ai/active-gateway";
import { toModelData } from "../ai/to-model-data";
import type { UsageInfo } from "../credits/cost-accumulator";
import { createToolUsage } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";

const tokenCost = (tokens: number | undefined, price: string | undefined) => {
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

/** Resolve provider usage before sealing a durable receipt; unknown pricing must not become free work. */
export const createEveToolCost = (usage: ToolUsage = createToolUsage()) => ({
  addAPICost(_name: string, costCents: number) {
    usage.addCostUsd(costCents / 100);
  },
  addImageCost(
    modelId: string,
    count: number,
    _usage: UsageInfo,
    _source: string
  ) {
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
  addLLMCost(modelId: string, tokens: UsageInfo, _source: string) {
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
