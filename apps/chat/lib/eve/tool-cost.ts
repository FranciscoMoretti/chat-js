import type { AiGatewayModel } from "@chat-js/gateways/models";

import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { UsageInfo } from "@/lib/credits/cost-accumulator";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { createToolUsage } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";

// Gateway records are Zod-parsed or generated literals; retain the selected pricing object while skipping an unused full ModelData projection.
const pricingForModel = (
  fetchedModels: readonly {
    readonly id: string;
    readonly pricing: ReadonlyNativeSurface<AiGatewayModel["pricing"]>;
  }[],
  modelId: string
): ReadonlyNativeSurface<AiGatewayModel["pricing"]> | undefined =>
  fetchedModels.find(
    (model: Readonly<Pick<AiGatewayModel, "id">>) => model.id === modelId
  )?.pricing;

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
    usage: Readonly<UsageInfo>,
    source: string
  ) => void;
  addLLMCost: (
    modelId: string,
    tokens: Readonly<UsageInfo>,
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
    _usage: Readonly<UsageInfo>,
    _source: string
  ): void {
    usage.addDeferredCost(async () => {
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid generated image count.");
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const rate = Number(pricingForModel(fetchedModels, modelId)?.image);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Image provider pricing is unavailable.");
      }
      return count * rate;
    });
  },
  addLLMCost(
    modelId: string,
    tokens: Readonly<UsageInfo>,
    _source: string
  ): void {
    usage.addDeferredCost(async () => {
      if (
        tokens.inputTokens === undefined ||
        tokens.outputTokens === undefined
      ) {
        throw new Error("Provider usage is unavailable.");
      }
      const fetchedModels = await getActiveGateway().fetchModels();
      const pricing = pricingForModel(fetchedModels, modelId);
      return (
        tokenCost(tokens.inputTokens, pricing?.input) +
        tokenCost(tokens.outputTokens, pricing?.output)
      );
    });
  },
  totalUsd: usage.totalUsd.bind(usage),
});
