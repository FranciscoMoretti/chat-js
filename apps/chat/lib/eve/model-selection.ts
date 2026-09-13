import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { wrapLanguageModel } from "ai";
import { z } from "zod";

import { getActiveGateway } from "../ai/active-gateway";
import { getFallbackModels } from "../ai/gateways/fallback-models";
import type { InstalledGateway } from "../ai/gateways/registry";
import type { ModelData } from "../ai/model-data";
import { toModelData } from "../ai/to-model-data";
import { config } from "../config";

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));

export class EveModelUnavailableError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EveModelUnavailableError";
  }
}

export const getEveModelDefinition = (
  requestedId?: string,
  models = getFallbackModels(config.ai.gateway).map(toModelData)
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
    apiModelId: model.id as Parameters<
      InstalledGateway["createLanguageModel"]
    >[0],
    reasoning: !!model.reasoning && id.endsWith("-reasoning"),
  };
};

let catalog: { expires: number; models: ModelData[] } | undefined;
let loading: Promise<ModelData[]> | undefined;

export const loadEveModelDefinition = async (requestedId?: string) => {
  if (!catalog || catalog.expires < Date.now()) {
    loading ??= (async () => {
      try {
        const models = await getActiveGateway().fetchModels();
        const converted = models.map(toModelData);
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

export const resolveEveModel = async (requestedId?: string) => {
  const model = await loadEveModelDefinition(requestedId);
  return {
    model: wrapLanguageModel({
      middleware: { specificationVersion: "v4" },
      model: getActiveGateway().createLanguageModel(model.apiModelId),
      modelId: requestedId ?? config.ai.workflows.chat,
    }),
    modelContextWindowTokens: model.context_window,
    modelOptions: {
      // oxlint-disable-next-line unicorn/prefer-structured-clone -- Exercise the JSON wire representation; structuredClone preserves values JSON drops.
      providerOptions: serializedOptions.parse(
        // oxlint-disable-next-line unicorn/prefer-structured-clone -- Use JSON wire normalization, which deliberately omits non-JSON values.
        JSON.parse(JSON.stringify(getModelProviderOptions(model)))
      ),
    },
  };
};
