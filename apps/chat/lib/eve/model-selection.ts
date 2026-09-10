import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { z } from "zod";
import { getActiveGateway } from "../ai/active-gateway";
import { getFallbackModels } from "../ai/gateways/fallback-models";
import type { ModelData } from "../ai/model-data";
import { toModelData } from "../ai/to-model-data";
import { config } from "../config";

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));

export function getEveModelDefinition(
  requestedId?: string,
  models = getFallbackModels(config.ai.gateway).map(toModelData)
) {
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
    throw new Error("This model is not available for chat.");
  }
  return {
    ...model,
    apiModelId: model.id,
    reasoning: !!model.reasoning && id.endsWith("-reasoning"),
  };
}

let catalog: { expires: number; models: ModelData[] } | undefined;
let loading: Promise<ModelData[]> | undefined;

export async function loadEveModelDefinition(requestedId?: string) {
  if (!catalog || catalog.expires < Date.now()) {
    loading ??= getActiveGateway()
      .fetchModels()
      .then((models) => {
        const converted = models.map(toModelData);
        catalog = { expires: Date.now() + 3_600_000, models: converted };
        return converted;
      })
      .finally(() => {
        loading = undefined;
      });
    return getEveModelDefinition(requestedId, await loading);
  }
  return getEveModelDefinition(requestedId, catalog.models);
}

export async function resolveEveModel(requestedId?: string) {
  const model = await loadEveModelDefinition(requestedId);
  return {
    model: getActiveGateway().createLanguageModel(model.id),
    modelContextWindowTokens: model.context_window,
    modelOptions: {
      providerOptions: serializedOptions.parse(
        JSON.parse(JSON.stringify(getModelProviderOptions(model)))
      ),
    },
  };
}
