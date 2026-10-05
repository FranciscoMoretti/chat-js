import { unstable_cache as cache } from "next/cache";

import { config } from "@/lib/config";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AppModelId, ModelId } from "./app-model-id";
/* oxlint-enable sort-imports */
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";
/* oxlint-enable sort-imports */

type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
};

const DISABLED_MODELS = new Set(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Returned definitions retain mutable tags/pricing references from catalog records; deep-readonly inputs would require cloning or a public ModelData return-type change.
const buildAppModels = (models: readonly ModelData[]): AppModelDefinition[] =>
  models
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Shallow model copies preserve mutable nested catalog references in the returned public definitions.
    .flatMap((model) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Runtime gateway catalogs may contain new string IDs beyond the SDK literal union; keep their existing ModelId contract without rejecting newly available models.
      const modelId = model.id as ModelId;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The existing app API exposes synthetic -reasoning variants using AppModelId even though the provider literal union does not include that suffix.
        const reasoningId = `${modelId}-reasoning` as AppModelId;

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
            id: modelId,
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
          id: modelId,
        },
      ];
    })
    .filter(
      (model: {
        readonly type: ModelData["type"];
        readonly disabled: boolean;
      }) => model.type === "language" && !model.disabled
    );

const buildChatModels = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Sorting/filtering retains original model records with mutable nested fields in the public return array.
  appModels: readonly AppModelDefinition[]
): AppModelDefinition[] =>
  appModels
    .filter(
      (model: { readonly output: { readonly text: boolean } }) =>
        model.output.text
    )
    .toSorted(
      (
        leftModel: { readonly owned_by: string },
        rightModel: { readonly owned_by: string }
      ) => {
        const leftProviderIndex = PROVIDER_ORDER.indexOf(leftModel.owned_by);
        const rightProviderIndex = PROVIDER_ORDER.indexOf(rightModel.owned_by);

        const leftIndex =
          // oxlint-disable-next-line no-magic-numbers -- indexOf uses -1 for an unlisted provider, which sorts after configured providers.
          leftProviderIndex === -1 ? PROVIDER_ORDER.length : leftProviderIndex;
        const rightIndex =
          // oxlint-disable-next-line no-magic-numbers -- indexOf uses -1 for an unlisted provider, which sorts after configured providers.
          rightProviderIndex === -1
            ? PROVIDER_ORDER.length
            : rightProviderIndex;

        return leftIndex - rightIndex;
      }
    );

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchAllAppModels's awaited sequencing and rejected-Promise behavior. */
const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchChatModels's awaited sequencing and rejected-Promise behavior. */
const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getAppModelDefinition's awaited sequencing and rejected-Promise behavior. */
const getAppModelDefinition = async (
  modelId: AppModelId
): Promise<AppModelDefinition> => {
  const models = await fetchAllAppModels();
  const model = models.find(
    (candidateModel: { readonly id: AppModelId }) =>
      candidateModel.id === modelId
  );
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
};
/* oxlint-enable oxc/no-async-await */
/**
 * Whether the generated catalog belongs to the selected gateway.
 * @param {string} gateway - Gateway identity from application configuration.
 * @returns {boolean} True when generated IDs can be used to identify previously known models.
 */
const snapshotMatchesGateway = (gateway: string): boolean =>
  generatedForGateway === gateway;

const KNOWN_MODEL_IDS = new Set<string>(
  snapshotMatchesGateway(config.ai.gateway)
    ? generatedModels.map((model: { readonly id: string }) => model.id)
    : []
);

/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 * @param {readonly { readonly id: AppModelId; readonly apiModelId: ModelId }[]} appModels - Available application variants and their provider IDs.
 * @returns {Set<AppModelId>} Curated IDs, their available reasoning variants, and IDs absent from the matching generated catalog.
 */
const getDefaultEnabledModels = (
  appModels: readonly {
    readonly id: AppModelId;
    readonly apiModelId: ModelId;
  }[]
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (fetchChatModels, getAppModelDefinition, getDefaultEnabledModels); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { fetchChatModels, getAppModelDefinition, getDefaultEnabledModels };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AppModelDefinition); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { AppModelDefinition };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AppModelId, ModelId); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { AppModelId, ModelId } from "./app-model-id";
/* oxlint-enable import/no-named-export */
