import { unstable_cache as cache } from "next/cache";

import { config } from "@/lib/config";

import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";

/* oxlint-disable import/exports-last --
 * import/exports-last (#522): export from "./app-model-id" is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 */
export type { AppModelId, ModelId } from "./app-model-id";
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last --
 * import/exports-last (#522): AppModelDefinition is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 */
export type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
};
/* oxlint-enable import/exports-last */

const DISABLED_MODELS = new Set(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): buildAppModels accepts models: ModelData[]; model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const buildAppModels = (models: ModelData[]): AppModelDefinition[] =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Gateway catalog IDs and derived reasoning variants share the application model union; redesigning generated catalog typing requires a gateway contract migration.
  models
    .flatMap((model) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Gateway catalog IDs and derived reasoning variants share the application model union; redesigning generated catalog typing requires a gateway contract migration.
      const modelId = model.id as ModelId;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Gateway catalog IDs and derived reasoning variants share the application model union; redesigning generated catalog typing requires a gateway contract migration.
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
    .filter(
      (model) => model.type === "language" && !model.disabled
    ) as AppModelDefinition[];
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * id-length (#506): buildChatModels uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): buildChatModels uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): buildChatModels accepts appModels: AppModelDefinition[]; model; a; b; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const buildChatModels = (
  appModels: AppModelDefinition[]
): AppModelDefinition[] =>
  appModels
    .filter((model) => model.output.text)
    .toSorted((a, b) => {
      const aProviderIndex = PROVIDER_ORDER.indexOf(a.owned_by);
      const bProviderIndex = PROVIDER_ORDER.indexOf(b.owned_by);

      const aIndex =
        aProviderIndex === -1 ? PROVIDER_ORDER.length : aProviderIndex;
      const bIndex =
        bProviderIndex === -1 ? PROVIDER_ORDER.length : bProviderIndex;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return 0;
    });
/* oxlint-enable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types */

const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): fetchChatModels is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): fetchChatModels stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable id-length, import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types --
 * id-length (#506): getAppModelDefinition uses m as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/exports-last (#522): getAppModelDefinition is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getAppModelDefinition stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): getAppModelDefinition accepts m; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getAppModelDefinition = async (
  modelId: AppModelId
): Promise<AppModelDefinition> => {
  const models = await fetchAllAppModels();
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
};
/* oxlint-enable id-length, import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types */

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

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types --
 * id-length (#506): KNOWN_MODEL_IDS uses m as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/prefer-readonly-parameter-types (#565): KNOWN_MODEL_IDS accepts m; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const KNOWN_MODEL_IDS = new Set<string>(
  snapshotMatchesGateway(config.ai.gateway)
    ? generatedModels.map((m) => m.id)
    : []
);
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): getDefaultEnabledModels stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): getDefaultEnabledModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getDefaultEnabledModels's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): getDefaultEnabledModels accepts appModels: AppModelDefinition[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 */
export const getDefaultEnabledModels = (
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */
