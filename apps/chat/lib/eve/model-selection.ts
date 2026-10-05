import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { wrapLanguageModel } from "ai";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getActiveGateway } from "@/lib/ai/active-gateway";
/* oxlint-enable sort-imports */
import { getFallbackModels } from "@/lib/ai/gateways/fallback-models";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { InstalledGateway } from "@/lib/ai/gateways/registry";
/* oxlint-enable sort-imports */
import type { ModelData } from "@/lib/ai/model-data";
import { toModelData } from "@/lib/ai/to-model-data";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));
const MODEL_CATALOG_TTL_MS = 3_600_000;
const MODEL_ID_PARAMETER_INDEX = 0;
type EveModelDefinition = ModelData & {
  apiModelId: Parameters<
    InstalledGateway["createLanguageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX];
};

class EveModelUnavailableError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "EveModelUnavailableError";
  }
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): getEveModelDefinition accepts models = getFallbackModels(config.ai.gateway).map((model) => toModelData(model) ); model; item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getEveModelDefinition = (
  requestedId?: string,
  models = getFallbackModels(config.ai.gateway).map((model) =>
    toModelData(model)
  )
): EveModelDefinition => {
  const id = requestedId ?? config.ai.workflows.chat;
  const model = models.find(
    (item) =>
      item.id === id || (item.reasoning && `${item.id}-reasoning` === id)
  );
  if (
    !model ||
    model.type !== "language" ||
    !model.output.text ||
    config.ai.disabledModels.some((disabled) => disabled === model.id)
  ) {
    throw new EveModelUnavailableError("This model is not available for chat.");
  }
  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...model,
    // The active gateway catalog above validates this ID at the runtime boundary.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The selected installed gateway determines valid model IDs at runtime; a generic gateway redesign is needed to encode that relationship.
    apiModelId: model.id as EveModelDefinition["apiModelId"],
    reasoning: model.reasoning && id.endsWith("-reasoning"),
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable init-declarations --
 * init-declarations (#507): catalog assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let catalog: { expires: number; models: ModelData[] } | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable init-declarations --
 * init-declarations (#507): loading assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let loading: Promise<ModelData[]> | undefined;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve loadEveModelDefinition's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations */

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types -- no-undefined (#519): loadEveModelDefinition uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): loadEveModelDefinition accepts model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const loadEveModelDefinition = async (
  requestedId?: string
): Promise<EveModelDefinition> => {
  if (!catalog || catalog.expires < Date.now()) {
    loading ??= (async (): Promise<ModelData[]> => {
      try {
        const models = await getActiveGateway().fetchModels();
        const converted = models.map((model) => toModelData(model));
        catalog = {
          expires: Date.now() + MODEL_CATALOG_TTL_MS,
          models: converted,
        };
        return converted;
      } finally {
        loading = undefined;
      }
    })();
    return getEveModelDefinition(requestedId, await loading);
  }
  return getEveModelDefinition(requestedId, catalog.models);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveEveModel's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */

/* oxlint-disable unicorn/max-nested-calls -- typescript/explicit-function-return-type (#560): Keep resolveEveModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
unicorn/max-nested-calls (#568): resolveEveModel keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const resolveEveModel = async (
  requestedId?: string
): Promise<{
  model: ReturnType<typeof wrapLanguageModel>;
  modelContextWindowTokens: number;
  modelOptions: { providerOptions: z.output<typeof serializedOptions> };
}> => {
  const model = await loadEveModelDefinition(requestedId);
  return {
    model: wrapLanguageModel({
      middleware: { specificationVersion: "v4" },
      model: getActiveGateway().createLanguageModel(model.apiModelId),
      modelId: requestedId ?? config.ai.workflows.chat,
    }),
    modelContextWindowTokens: model.context_window,
    modelOptions: {
      providerOptions: serializedOptions.parse(
        // oxlint-disable-next-line unicorn/prefer-structured-clone -- Use JSON wire normalization, which deliberately omits non-JSON values.
        JSON.parse(JSON.stringify(getModelProviderOptions(model)))
      ),
    },
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveModelUnavailableError, getEveModelDefinition, loadEveModelDefinition, resolveEveModel); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
export {
  EveModelUnavailableError,
  getEveModelDefinition,
  loadEveModelDefinition,
  resolveEveModel,
};
/* oxlint-enable import/no-named-export */
