import type { SessionModel } from "@/lib/session-profile-contracts";
import { getModelProviderOptions } from "@chat-js/gateways/provider-options";
import { wrapLanguageModel } from "ai";
import { z } from "zod";

import { getActiveGateway } from "@/lib/ai/active-gateway";
import { getFallbackModels } from "@/lib/ai/gateways/fallback-models";
import type { ModelData } from "@/lib/ai/model-data";
import type { ReadonlyAiGatewayModel } from "@/lib/ai/to-model-data";
import { toModelData } from "@/lib/ai/to-model-data";
import { config } from "@/lib/config";

const serializedOptions = z.record(z.string(), z.record(z.string(), z.json()));
const MODEL_CATALOG_TTL_MS = 3_600_000;
type EveModelDefinition = ModelData & {
  apiModelId: string;
};

class EveModelUnavailableError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "EveModelUnavailableError";
  }
}

const getEveModelDefinition = (
  requestedId?: string,
  models: readonly ModelData[] = getFallbackModels(config.ai.gateway).map(
    (model: Readonly<ReadonlyAiGatewayModel>) => toModelData(model)
  )
): EveModelDefinition => {
  const id = requestedId ?? config.ai.workflows.chat;
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
  };
};

let catalog: { expires: number; models: ModelData[] } | undefined;
let loading: Promise<ModelData[]> | undefined;

const loadEveModelDefinition = async (
  requestedId?: string
): Promise<EveModelDefinition> => {
  if (!catalog || catalog.expires < Date.now()) {
    loading ??= (async (): Promise<ModelData[]> => {
      try {
        const models = await getActiveGateway().fetchModels();
        const converted = models.map(
          (model: Readonly<ReadonlyAiGatewayModel>) => toModelData(model)
        );
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

const resolveEveModel = async (requestedId?: string): Promise<SessionModel> => {
  const model = await loadEveModelDefinition(requestedId);
  return {
    model: wrapLanguageModel({
      middleware: { specificationVersion: "v4" },
      model: getActiveGateway().createLanguageModel(model.apiModelId),
      modelId: requestedId ?? config.ai.workflows.chat,
    }),
    modelContextWindowTokens: model.context_window,
    modelOptions: {
      providerOptions: serializedOptions.parse(getModelProviderOptions(model)),
    },
  };
};
export {
  EveModelUnavailableError,
  getEveModelDefinition,
  loadEveModelDefinition,
  resolveEveModel,
};
