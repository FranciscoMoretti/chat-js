import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import { getAppModelDefinition } from "@/lib/ai/app-models";
// oxlint-disable-next-line eslint/sort-imports -- Preserve runtime module evaluation order and keep type-only declarations beside the owning module; the pinned binding-order rule requires a different grouping.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const CENTS_PER_DOLLAR = 100;
const NO_TOKEN_USAGE = 0;
const NO_COST_CENTS = 0;
const NO_IMAGE_PRICE = 0;

/** Minimal usage info needed for cost calculation */
interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
}

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
  const inputCost =
    (usage.inputTokens ?? NO_TOKEN_USAGE) * Number(pricing.input);
  const outputCost =
    (usage.outputTokens ?? NO_TOKEN_USAGE) * Number(pricing.output);
  return (inputCost + outputCost) * CENTS_PER_DOLLAR;
};
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
type CostEntryTag = Readonly<Pick<CostEntry, "type">>;

const addImageCosts = (
  initialCost: number,
  entries: readonly { readonly modelId: string; readonly count: number }[],
  models: readonly {
    readonly id: string;
    readonly pricing?: { readonly image?: string };
  }[]
): number => {
  let total = initialCost;
  for (const entry of entries) {
    const price = Number(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading image from models.find(...).pricing; read pricing from models.find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      models.find((model) => model.id === entry.modelId)?.pricing?.image
    );
    if (Number.isFinite(price) && price > NO_IMAGE_PRICE) {
      total += price * entry.count * CENTS_PER_DOLLAR;
    }
  }
  return total;
};
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

    usage: ReadonlyNativeSurface<UsageInfo>,
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
  // oxlint-disable-next-line max-params -- The public tool cost interface supplies model, count, usage and source as four positional arguments.
  public addImageCost(
    modelId: string,
    count: number,

    usage: ReadonlyNativeSurface<UsageInfo>,
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
    if (cost > NO_COST_CENTS) {
      this.entries.push({ apiName, cost, type: "api" });
    }
  }
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getTotalCost's awaited sequencing and rejected-Promise behavior. */
  /**
   * Resolve known catalog prices and total the recorded charges.
   * @returns {Promise<number>} Total cents rounded up after summation; unavailable LLM/image prices contribute no charge.
   */
  // oxlint-disable-next-line max-statements -- Snapshot entries before awaiting catalogs, then price images and deduplicated LLMs in order; splitting this sequence must preserve concurrent recording and final-rounding behavior.
  public async getTotalCost(): Promise<number> {
    let total = NO_COST_CENTS;
    const llmEntries = this.entries.filter(
      (entry: CostEntryTag): entry is LLMCostEntry => entry.type === "llm"
    );
    const apiEntries = this.entries.filter(
      (entry: CostEntryTag): entry is APICostEntry => entry.type === "api"
    );
    // Sum API costs directly
    for (const entry of apiEntries) {
      total += entry.cost;
    }
    const imageEntries = this.entries.filter(
      (entry: CostEntryTag): entry is ImageCostEntry => entry.type === "image"
    );
    // oxlint-disable-next-line no-magic-numbers -- The explicit length check uses zero to distinguish an empty image batch.
    if (imageEntries.length > 0) {
      const { fetchModels } = await import("@/lib/ai/models");
      // Match LLM pricing: skip unavailable catalog prices and finalize known costs.
      const models = await fetchModels().catch(() => []);
      total = addImageCosts(total, imageEntries, models);
    }
    // oxlint-disable-next-line no-magic-numbers -- An empty LLM batch needs no model lookups.
    if (llmEntries.length === 0) {
      return Math.ceil(total);
    }
    // Batch model definition lookups (dedupe by modelId)
    const uniqueModelIds = [
      ...new Set(
        llmEntries.map(
          (entry: { readonly modelId: AppModelId }) => entry.modelId
        )
      ),
    ];
    const modelDefinitions = await Promise.all(
      // oxlint-disable-next-line typescript/promise-function-async, unicorn/no-null -- Preserve each catalog promise's timing; failed lookups use the existing null sentinel so only known models contribute charges.
      uniqueModelIds.map((id) => getAppModelDefinition(id).catch(() => null))
    );
    const modelById = new Map<AppModelId, AppModelDefinition | null>(
      uniqueModelIds.map((id, modelIndex) => [id, modelDefinitions[modelIndex]])
    );
    // Sum LLM costs (unrounded) then ceil at the end
    for (const entry of llmEntries) {
      const model = modelById.get(entry.modelId);
      // oxlint-disable-next-line typescript/strict-boolean-expressions, oxc/no-optional-chaining -- Nonempty pricing strings narrow optional catalog rates while preserving one guard read per rate and the existing getter order. Optional chain: Keep the existing nullish guard when reading input from model.pricing; read pricing from model; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. Keep the existing nullish guard when reading output from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (model?.pricing?.input && model.pricing?.output) {
        total += calculateLLMCost(entry.usage, {
          input: model.pricing.input,
          output: model.pricing.output,
        });
      }
    }
    return Math.ceil(total);
  }
  /* oxlint-enable oxc/no-async-await */
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
    // oxlint-disable-next-line no-magic-numbers -- Zero entries is the public empty-accumulator state.
    return this.entries.length > 0;
  }
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CostAccumulator); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { CostAccumulator };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (UsageInfo); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { UsageInfo };
/* oxlint-enable import/no-named-export */
