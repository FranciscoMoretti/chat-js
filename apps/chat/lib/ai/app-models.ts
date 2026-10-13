import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";
import type { AppModelId } from "./app-model-id";
import type { ModelData } from "./model-data";

import { unstable_cache as cache } from "next/cache";
import { config } from "@/lib/config";
import { fetchModels } from "./models";

type AppModelDefinition = Omit<ModelData, "id"> & {
  readonly id: AppModelId;
  readonly apiModelId: string;
};

const DISABLED_MODELS = new Set<string>(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

const buildAppModels = (models: readonly ModelData[]): AppModelDefinition[] =>
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
          leftProviderIndex === -1 ? PROVIDER_ORDER.length : leftProviderIndex;
        const rightIndex =
          rightProviderIndex === -1
            ? PROVIDER_ORDER.length
            : rightProviderIndex;

        return leftIndex - rightIndex;
      }
    );

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
 * @param {readonly { readonly id: AppModelId; readonly apiModelId: string }[]} appModels - Available application variants and their provider IDs.
 * @returns {Set<AppModelId>} Curated IDs, their available reasoning variants, and IDs absent from the matching generated catalog.
 */
const getDefaultEnabledModels = (
  appModels: readonly {
    readonly id: AppModelId;
    readonly apiModelId: string;
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
export { fetchChatModels, getAppModelDefinition, getDefaultEnabledModels };
export type { AppModelDefinition };
export type { AppModelId } from "./app-model-id";
