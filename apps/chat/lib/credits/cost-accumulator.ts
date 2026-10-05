/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/app-models" dependency within this package instead of introducing an alias or barrel API.
 */
import type { AppModelDefinition, AppModelId } from "../ai/app-models";
import { getAppModelDefinition } from "../ai/app-models";
/* oxlint-enable import/no-relative-parent-imports */

/** Minimal usage info needed for cost calculation */
interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
}

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): calculateLLMCost uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/**
 * Calculate LLM cost in CENTS from AI SDK usage data and model pricing.
 * Pricing is per-token in dollars (e.g., "0.00000006" = $0.06 per million tokens).
 * @param {Readonly<UsageInfo>} usage Input and output token counts, with absent counts treated as zero.
 * @param {{ readonly input: string; readonly output: string; }} pricing Dollar-per-token prices parsed for the two token categories.
 * @returns {number} Unrounded total cost in cents for the supplied counts and prices.
 */
const calculateLLMCost = (
  usage: Readonly<UsageInfo>,
  pricing: {
    readonly input: string;
    readonly output: string;
  }
): number => {
  const inputCost = (usage.inputTokens ?? 0) * Number(pricing.input);
  const outputCost = (usage.outputTokens ?? 0) * Number(pricing.output);
  return (inputCost + outputCost) * 100;
};
/* oxlint-enable no-magic-numbers */
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
/* oxlint-disable import/no-relative-parent-imports, max-params, max-statements, no-continue, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/models" dependency within this package instead of introducing an alias or barrel API.
 * max-params (#511): CostAccumulator keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): CostAccumulator keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): CostAccumulator skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): CostAccumulator uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): CostAccumulator accepts usage: UsageInfo; entry; model; e; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): CostAccumulator preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): CostAccumulator intentionally keeps the existing falsy-value behavior of model?.pricing?.input; model?.pricing?.output; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): CostAccumulator preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Accumulates costs from multiple LLM and external API calls.
 * Pass through call chain, collect at request end.
 */
class CostAccumulator {
  private readonly entries: CostEntry[] = [];
  /**
   * Record token usage for later pricing from the application model catalog.
   * @param {AppModelId} modelId Model identity used to look up per-token prices.
   * @param {UsageInfo} usage Original usage object retained until total calculation.
   * @param {string} source Calling operation recorded in the cost breakdown.
   */
  public addLLMCost(
    modelId: AppModelId,
    usage: UsageInfo,
    source: string
  ): void {
    this.entries.push({ modelId, source, type: "llm", usage });
  }
  /**
   * Record dedicated image generation for later dollar-per-image catalog pricing.
   * @param {string} modelId Gateway catalog model whose image price is used.
   * @param {number} count Generated image count multiplied by the known catalog price.
   * @param {UsageInfo} usage Original usage metadata retained in the breakdown.
   * @param {string} source Calling operation recorded in the cost breakdown.
   */
  public addImageCost(
    modelId: string,
    count: number,
    usage: UsageInfo,
    source: string
  ): void {
    this.entries.push({ count, modelId, source, type: "image", usage });
  }
  /**
   * Record a positive fixed external API charge in cents; nonpositive charges are ignored.
   * @param {string} apiName External service identity recorded in the breakdown.
   * @param {number} cost Fixed charge in cents.
   */
  public addAPICost(apiName: string, cost: number): void {
    if (cost > 0) {
      this.entries.push({ apiName, cost, type: "api" });
    }
  }
  /**
   * Resolve known catalog prices and total the recorded charges.
   * @returns {Promise<number>} Total cents rounded up after summation; unavailable LLM/image prices contribute no charge.
   */
  public async getTotalCost(): Promise<number> {
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
    const uniqueModelIds = [
      ...new Set(llmEntries.map((entry) => entry.modelId)),
    ];
    const modelDefinitions = await Promise.all(
      uniqueModelIds.map((id) => getAppModelDefinition(id).catch(() => null))
    );
    const modelById = new Map<AppModelId, AppModelDefinition | null>(
      uniqueModelIds.map((id, modelIndex) => [id, modelDefinitions[modelIndex]])
    );
    // Sum LLM costs (unrounded) then ceil at the end
    for (const entry of llmEntries) {
      const model = modelById.get(entry.modelId);
      if (!(model?.pricing?.input && model?.pricing?.output)) {
        // Skip unknown models
        continue;
      }
      total += calculateLLMCost(entry.usage, {
        input: model.pricing.input,
        output: model.pricing.output,
      });
    }
    return Math.ceil(total);
  }
  /**
   * Inspect the recorded cost breakdown.
   * @returns {CostEntry[]} A new array containing the original recorded entry objects.
   */
  public getEntries(): CostEntry[] {
    return [...this.entries];
  }
  /**
   * Inspect whether the accumulator has any recorded entries.
   * @returns {boolean} Whether at least one LLM, image or positive API charge was recorded.
   */
  public hasEntries(): boolean {
    return this.entries.length > 0;
  }
}
/* oxlint-enable import/no-relative-parent-imports, max-params, max-statements, no-continue, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */
export { CostAccumulator };
export type { UsageInfo };
