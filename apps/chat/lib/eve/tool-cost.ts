import { getActiveGateway } from "../ai/active-gateway";
import { toModelData } from "../ai/to-model-data";
import type { UsageInfo } from "../credits/cost-accumulator";

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
export const createEveToolCost = () => {
  let apiCostUsd = 0;
  const images: { count: number; modelId: string }[] = [];
  const llm: { modelId: string; usage: UsageInfo }[] = [];
  return {
    addAPICost(_name: string, costCents: number) {
      if (!Number.isFinite(costCents) || costCents < 0) {
        throw new Error("Invalid platform tool cost.");
      }
      apiCostUsd += costCents / 100;
    },
    addImageCost(
      modelId: string,
      count: number,
      _usage: UsageInfo,
      _source: string
    ) {
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid generated image count.");
      }
      images.push({ count, modelId });
    },
    addLLMCost(modelId: string, usage: UsageInfo, _source: string) {
      llm.push({ modelId, usage });
    },
    async totalUsd() {
      if (!(llm.length || images.length)) {
        return apiCostUsd;
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const models = fetchedModels.map(toModelData);
      let total = apiCostUsd;
      for (const { count, modelId } of images) {
        const rate = Number(
          models.find((model) => model.id === modelId)?.pricing?.image
        );
        if (!Number.isFinite(rate) || rate < 0) {
          throw new Error("Image provider pricing is unavailable.");
        }
        total += count * rate;
      }
      for (const { modelId, usage } of llm) {
        const pricing = models.find((model) => model.id === modelId)?.pricing;
        if (
          usage.inputTokens === undefined ||
          usage.outputTokens === undefined
        ) {
          throw new Error("Image provider usage is unavailable.");
        }
        total +=
          tokenCost(usage.inputTokens, pricing?.input) +
          tokenCost(usage.outputTokens, pricing?.output);
      }
      return total;
    },
  };
};
