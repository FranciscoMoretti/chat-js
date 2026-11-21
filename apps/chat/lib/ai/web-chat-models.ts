import { webModels } from "@/integrations/chat/models";
import { config } from "@/lib/config";
import type { ModelData } from "./model-data";

type AppModelDefinition = ModelData & { readonly apiModelId: string };

const settings: {
  readonly model?: string;
  readonly modelIds?: readonly string[];
  readonly allowedModels?: readonly string[];
} = webModels;

const getConfiguredWebChatModel = (
  defaultModelId: string = config.ai.workflows.chat
): string => settings.model ?? defaultModelId;

const getModelIds = (defaultModelId: string): readonly string[] => {
  if (settings.modelIds !== undefined) {
    return settings.modelIds;
  }

  // Older scaffolds listed alternatives to the default model.
  const alternatives = settings.allowedModels ?? [];
  return alternatives.length > 0 ? [defaultModelId, ...alternatives] : [];
};

const isWebChatModelAllowed = (
  modelId: string,
  defaultModelId = getConfiguredWebChatModel()
): boolean => {
  const modelIds = getModelIds(defaultModelId);
  return modelIds.length === 0 || modelIds.includes(modelId);
};

const providerRank = (provider: string): number => {
  const index = config.ai.providerOrder.indexOf(provider);
  return index === -1 ? config.ai.providerOrder.length : index;
};

const recommendedIds = new Set<string>(config.ai.curatedDefaults);
const disabledIds = new Set<string>(config.ai.disabledModels);

const buildWebChatModels = (
  models: readonly ModelData[],
  defaultModelId = getConfiguredWebChatModel()
): AppModelDefinition[] => {
  const modelIds = getModelIds(defaultModelId);
  return models
    .flatMap((model: Readonly<ModelData>): AppModelDefinition[] => {
      if (
        model.type !== "language" ||
        !model.output.text ||
        disabledIds.has(model.id)
      ) {
        return [];
      }
      const standard = { ...model, apiModelId: model.id, reasoning: false };
      return model.reasoning
        ? [
            { ...model, apiModelId: model.id, id: `${model.id}-reasoning` },
            standard,
          ]
        : [standard];
    })
    .filter((model) => modelIds.length === 0 || modelIds.includes(model.id))
    .toSorted(
      (left, right) =>
        Number(recommendedIds.has(right.apiModelId)) -
          Number(recommendedIds.has(left.apiModelId)) ||
        providerRank(left.owned_by) - providerRank(right.owned_by)
    );
};

const getDefaultWebChatModelId = (
  models: readonly Pick<AppModelDefinition, "apiModelId" | "id">[],
  preferredModelId = getConfiguredWebChatModel()
): string | undefined =>
  models.find((model) => model.id === preferredModelId)?.id ??
  models.find((model) => model.id === model.apiModelId)?.id ??
  models[0]?.id;

export {
  buildWebChatModels,
  getConfiguredWebChatModel,
  getDefaultWebChatModelId,
  isWebChatModelAllowed,
};
export type { AppModelDefinition };
