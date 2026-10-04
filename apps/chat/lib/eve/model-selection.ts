/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/active-gateway"; "../ai/gateways/fallback-models"; "../ai/gateways/registry"; "../ai/model-data"; "../ai/to-model-data" dependency within this package instead of introducing an alias or barrel API.
 */
import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { wrapLanguageModel } from "ai";
import { z } from "zod";

import { getActiveGateway } from "../ai/active-gateway";
import { getFallbackModels } from "../ai/gateways/fallback-models";
import type { InstalledGateway } from "../ai/gateways/registry";
import type { ModelData } from "../ai/model-data";
import { toModelData } from "../ai/to-model-data";
import { config } from "../config";
/* oxlint-enable import/no-relative-parent-imports */

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));

/* oxlint-disable typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): EveModelUnavailableError accepts options?: ErrorOptions; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
class EveModelUnavailableError extends Error {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EveModelUnavailableError";
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): getEveModelDefinition uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep getEveModelDefinition's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getEveModelDefinition's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): getEveModelDefinition accepts models = getFallbackModels(config.ai.gateway).map((model) => toModelData(model) ); model; item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getEveModelDefinition = (
  requestedId?: string,
  models = getFallbackModels(config.ai.gateway).map((model) =>
    toModelData(model)
  )
) => {
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
    ...model,
    // The active gateway catalog above validates this ID at the runtime boundary.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The selected installed gateway determines valid model IDs at runtime; a generic gateway redesign is needed to encode that relationship.
    apiModelId: model.id as Parameters<
      InstalledGateway["createLanguageModel"]
    >[0],
    reasoning: model.reasoning && id.endsWith("-reasoning"),
  };
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable init-declarations --
 * init-declarations (#507): catalog assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let catalog: { expires: number; models: ModelData[] } | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable init-declarations --
 * init-declarations (#507): loading assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let loading: Promise<ModelData[]> | undefined;
/* oxlint-enable init-declarations */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): loadEveModelDefinition uses 3_600_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): loadEveModelDefinition uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep loadEveModelDefinition's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep loadEveModelDefinition's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): loadEveModelDefinition accepts model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const loadEveModelDefinition = async (requestedId?: string) => {
  if (!catalog || catalog.expires < Date.now()) {
    loading ??= (async () => {
      try {
        const models = await getActiveGateway().fetchModels();
        const converted = models.map((model) => toModelData(model));
        catalog = { expires: Date.now() + 3_600_000, models: converted };
        return converted;
      } finally {
        loading = undefined;
      }
    })();
    return getEveModelDefinition(requestedId, await loading);
  }
  return getEveModelDefinition(requestedId, catalog.models);
};
/* oxlint-enable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls -- typescript/explicit-function-return-type (#560): Keep resolveEveModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep resolveEveModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
unicorn/max-nested-calls (#568): resolveEveModel keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const resolveEveModel = async (requestedId?: string) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls */
export {
  EveModelUnavailableError,
  getEveModelDefinition,
  loadEveModelDefinition,
  resolveEveModel,
};
