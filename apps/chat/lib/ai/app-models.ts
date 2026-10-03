/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { unstable_cache as cache } from "next/cache";

import { config } from "@/lib/config";

import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";
/* oxlint-enable sort-imports */

/* oxlint-disable import/exports-last, import/no-named-export --
 * import/exports-last (#522): export from "./app-model-id" is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named export from "./app-model-id" API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type { AppModelId, ModelId } from "./app-model-id";
/* oxlint-enable import/exports-last, import/no-named-export */

/* oxlint-disable import/exports-last, import/no-named-export --
 * import/exports-last (#522): AppModelDefinition is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named AppModelDefinition API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
};
/* oxlint-enable import/exports-last, import/no-named-export */

const DISABLED_MODELS = new Set(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

/* oxlint-disable oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types --
 * oxc/no-rest-spread-properties (#543): buildAppModels copies or separates ...model while preserving existing object ownership; mutating source objects is not equivalent.
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
/* oxlint-enable oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types --
 * id-length (#506): buildChatModels uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): buildChatModels uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): buildChatModels derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
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
/* oxlint-enable id-length, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): fetchAllAppModels sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await --
 * import/exports-last (#522): fetchChatModels is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): fetchChatModels stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named fetchChatModels API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): fetchChatModels sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await */

/* oxlint-disable id-length, import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * id-length (#506): getAppModelDefinition uses m as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/exports-last (#522): getAppModelDefinition is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getAppModelDefinition stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getAppModelDefinition API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getAppModelDefinition sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
/* oxlint-enable id-length, import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

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

/* oxlint-disable id-length, no-ternary, typescript/prefer-readonly-parameter-types --
 * id-length (#506): KNOWN_MODEL_IDS uses m as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-ternary (#518): KNOWN_MODEL_IDS derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): KNOWN_MODEL_IDS accepts m; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const KNOWN_MODEL_IDS = new Set<string>(
  snapshotMatchesGateway(config.ai.gateway)
    ? generatedModels.map((m) => m.id)
    : []
);
/* oxlint-enable id-length, no-ternary, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): getDefaultEnabledModels stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getDefaultEnabledModels API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */
