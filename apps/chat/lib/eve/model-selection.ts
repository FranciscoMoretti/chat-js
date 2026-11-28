import type { SessionModel } from "@/chatjs/core/session/contracts";
import { getModelProviderOptions } from "@/integrations/chat/model-options";
import { wrapLanguageModel } from "ai";
import { z } from "zod";

import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { ModelData } from "@/lib/ai/model-data";
import { loadModelCatalog } from "@/lib/ai/model-catalog";
import {
  buildWebChatModels,
  getDefaultWebChatModelId,
} from "@/lib/ai/web-chat-models";
import { config } from "@/lib/config";

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));
type EveModelDefinition = ModelData & {
  apiModelId: string;
  selectedModelId: string;
};

class EveModelUnavailableError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "EveModelUnavailableError";
  }
}

const getEveModelDefinition = (
  id: string,
  models: readonly ModelData[]
): EveModelDefinition => {
  const model = models.find(
    (item: Readonly<ModelData>) =>
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
    apiModelId: model.id,
    reasoning: model.reasoning && id.endsWith("-reasoning"),
    selectedModelId: id,
  };
};

const defaultEveWebModelId = (
  models: readonly ModelData[],
  preferredModelId?: string
): string => {
  const id = getDefaultWebChatModelId(
    buildWebChatModels(models),
    preferredModelId
  );
  if (id === undefined) {
    throw new EveModelUnavailableError("No models are available for chat.");
  }
  return id;
};

const loadDefaultEveWebModelId = async (
  preferredModelId: string
): Promise<string> =>
  defaultEveWebModelId(await loadModelCatalog(), preferredModelId);

const loadEveModelDefinition = async (
  requestedId?: string
): Promise<EveModelDefinition> => {
  const models = await loadModelCatalog();
  return getEveModelDefinition(
    requestedId ?? defaultEveWebModelId(models),
    models
  );
};

const resolveEveModel = async (requestedId?: string): Promise<SessionModel> => {
  const model = await loadEveModelDefinition(requestedId);
  return {
    model: wrapLanguageModel({
      middleware: { specificationVersion: "v4" },
      model: getActiveGateway().createLanguageModel(model.apiModelId),
      modelId: model.selectedModelId,
    }),
    modelContextWindowTokens:
      model.context_window > 0 ? model.context_window : undefined,
    modelOptions: {
      providerOptions: serializedOptions.parse(getModelProviderOptions(model)),
    },
  };
};
export {
  EveModelUnavailableError,
  loadDefaultEveWebModelId,
  loadEveModelDefinition,
  resolveEveModel,
};
