import { unstable_cache as cache } from "next/cache";

import { config } from "@/lib/config";

import type { AppModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";

type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: string;
};

const DISABLED_MODELS = new Set<string>(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): buildAppModels accepts models: ModelData[]; model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const buildAppModels = (models: ModelData[]): AppModelDefinition[] =>
  models
    .flatMap((model): (AppModelDefinition & { disabled: boolean })[] => {
      const modelId = model.id;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning) {
        const reasoningId = `${modelId}-reasoning`;

        return [
          {
            ...model,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
            id: reasoningId,
          },
          {
            ...model,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
            reasoning: false,
          },
        ];
      }

      // Models without reasoning stay as-is
      return [
        {
          ...model,
          apiModelId: modelId,
          disabled: DISABLED_MODELS.has(modelId),
        },
      ];
    })
    .filter((model) => model.type === "language" && !model.disabled);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): buildChatModels uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): buildChatModels accepts appModels: AppModelDefinition[]; model; leftModel; rightModel; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const buildChatModels = (
  appModels: AppModelDefinition[]
): AppModelDefinition[] =>
  appModels
    .filter((model) => model.output.text)
    .toSorted((leftModel, rightModel) => {
      const aProviderIndex = PROVIDER_ORDER.indexOf(leftModel.owned_by);
      const bProviderIndex = PROVIDER_ORDER.indexOf(rightModel.owned_by);

      const aIndex =
        aProviderIndex === -1 ? PROVIDER_ORDER.length : aProviderIndex;
      const bIndex =
        bProviderIndex === -1 ? PROVIDER_ORDER.length : bProviderIndex;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return 0;
    });
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

/* oxlint-disable typescript/prefer-readonly-parameter-types --
moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): getAppModelDefinition accepts candidateModel; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getAppModelDefinition = async (
  modelId: AppModelId
): Promise<AppModelDefinition> => {
  const models = await fetchAllAppModels();
  const model = models.find((candidateModel) => candidateModel.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns --
 * jsdoc/require-param (#534): snapshotMatchesGateway's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): snapshotMatchesGateway's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/**
 * Set of model IDs from the generated models file.
 * Used to detect new models from the API that we haven't "decided" on yet.
 * When the snapshot was generated for a different gateway the IDs won't match,
 * so we fall back to an empty set (which auto-enables all models).
 */
const snapshotMatchesGateway = (gateway: string): boolean =>
  generatedForGateway === gateway;
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 *  * typescript/prefer-readonly-parameter-types (#565): KNOWN_MODEL_IDS accepts model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const KNOWN_MODEL_IDS = new Set<string>(
  snapshotMatchesGateway(config.ai.gateway)
    ? generatedModels.map((model) => model.id)
    : []
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): getDefaultEnabledModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): getDefaultEnabledModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/prefer-readonly-parameter-types (#565): getDefaultEnabledModels accepts appModels: AppModelDefinition[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 */
const getDefaultEnabledModels = (
  appModels: AppModelDefinition[]
): Set<AppModelId> => {
  const enabled = new Set<AppModelId>(config.ai.curatedDefaults);

  // If a curated default has a -reasoning variant, enable it too
  for (const model of appModels) {
    if (model.id.endsWith("-reasoning") && enabled.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  // Add any new models from the API that aren't in our generated snapshot
  for (const model of appModels) {
    if (!KNOWN_MODEL_IDS.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  return enabled;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */
export { fetchChatModels, getAppModelDefinition, getDefaultEnabledModels };
export type { AppModelDefinition };
export type { AppModelId, ModelId } from "./app-model-id";
