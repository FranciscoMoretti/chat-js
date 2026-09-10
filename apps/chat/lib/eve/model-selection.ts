import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { z } from "zod";
import { getActiveGateway } from "../ai/active-gateway";
import { getFallbackModels } from "../ai/gateways/fallback-models";
import { toModelData } from "../ai/to-model-data";
import { config } from "../config";

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));

export function getEveModelDefinition(requestedId?: string) {
  const id = requestedId ?? config.ai.workflows.chat;
  const model = getFallbackModels(config.ai.gateway)
    .map(toModelData)
    .find(
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

export function resolveEveModel(requestedId?: string) {
  const model = getEveModelDefinition(requestedId);
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
