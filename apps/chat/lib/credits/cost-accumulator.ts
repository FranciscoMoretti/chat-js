import type { AppModelDefinition, AppModelId } from "../ai/app-models";
import { getAppModelDefinition } from "../ai/app-models";

/** Minimal usage info needed for cost calculation */
export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Calculate LLM cost in CENTS from AI SDK usage data and model pricing.
 * Pricing is per-token in dollars (e.g., "0.00000006" = $0.06 per million tokens).
 */
function calculateLLMCost(
  usage: UsageInfo,
  pricing: { input: string; output: string }
): number {
  const inputCost = (usage.inputTokens ?? 0) * Number.parseFloat(pricing.input);
  const outputCost =
    (usage.outputTokens ?? 0) * Number.parseFloat(pricing.output);
  return (inputCost + outputCost) * 100;
}

interface LLMCostEntry {
  modelId: AppModelId;
  source: string;
  type: "llm";
  usage: UsageInfo;
}

interface APICostEntry {
  apiName: string;
  cost: number;
  type: "api";
}

interface ImageCostEntry {
  count: number;
  modelId: string;
  source: string;
  type: "image";
  usage: UsageInfo;
}

type CostEntry = LLMCostEntry | APICostEntry | ImageCostEntry;

/**
 * Accumulates costs from multiple LLM and external API calls.
 * Pass through call chain, collect at request end.
 */
export class CostAccumulator {
  private readonly entries: CostEntry[] = [];

  /** Add LLM cost from generateText/streamText usage */
  addLLMCost(modelId: AppModelId, usage: UsageInfo, source: string): void {
    this.entries.push({ type: "llm", modelId, usage, source });
  }

  /** Dedicated image models are priced per image, in dollars in the gateway catalog. */
  addImageCost(
    modelId: string,
    count: number,
    usage: UsageInfo,
    source: string
  ): void {
    this.entries.push({ type: "image", modelId, count, usage, source });
  }

  /** Add fixed external API cost (in cents) */
  addAPICost(apiName: string, cost: number): void {
    if (cost > 0) {
      this.entries.push({ type: "api", apiName, cost });
    }
  }

  /** Get total cost in cents, rounded up */
  async getTotalCost(): Promise<number> {
    let total = 0;

    const llmEntries = this.entries.filter(
      (entry): entry is LLMCostEntry => entry.type === "llm"
    );
    const apiEntries = this.entries.filter(
      (entry): entry is APICostEntry => entry.type === "api"
    );

    // Sum API costs directly
    for (const entry of apiEntries) {
      total += entry.cost;
    }

    const imageEntries = this.entries.filter((entry) => entry.type === "image");
    if (imageEntries.length > 0) {
      const { fetchModels } = await import("../ai/models");
      // Match LLM pricing: skip unavailable catalog prices and finalize known costs.
      const models = await fetchModels().catch(() => []);
      for (const entry of imageEntries) {
        const price = Number(
          models.find((model) => model.id === entry.modelId)?.pricing?.image
        );
        if (Number.isFinite(price) && price > 0) {
          total += price * entry.count * 100;
        }
      }
    }

    if (llmEntries.length === 0) {
      return Math.ceil(total);
    }

    // Batch model definition lookups (dedupe by modelId)
    const uniqueModelIds = [...new Set(llmEntries.map((e) => e.modelId))];
    const modelDefinitions = await Promise.all(
      uniqueModelIds.map((id) => getAppModelDefinition(id).catch(() => null))
    );
    const modelById = new Map<AppModelId, AppModelDefinition | null>(
      uniqueModelIds.map((id, i) => [id, modelDefinitions[i]])
    );

    // Sum LLM costs (unrounded) then ceil at the end
    for (const entry of llmEntries) {
      const model = modelById.get(entry.modelId);
      if (!(model?.pricing?.input && model?.pricing?.output)) {
        continue; // Skip unknown models
      }
      total += calculateLLMCost(entry.usage, {
        input: model.pricing.input,
        output: model.pricing.output,
      });
    }

    return Math.ceil(total);
  }

  /** Get breakdown of all cost entries */
  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  /** Check if any costs have been recorded */
  hasEntries(): boolean {
    return this.entries.length > 0;
  }
}
