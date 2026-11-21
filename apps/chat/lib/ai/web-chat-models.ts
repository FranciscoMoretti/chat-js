import { webModels } from "@/integrations/chat/models";
import { config } from "@/lib/config";
import type { ModelData } from "./model-data";

type AppModelDefinition = ModelData & { readonly apiModelId: string };

const getConfiguredWebChatModel = (
  defaultModelId: string = config.ai.workflows.chat
): string => webModels.model ?? defaultModelId;

const isWebChatModelAllowed = (modelId: string): boolean => {
  const { modelIds } = webModels;
  return (
    modelIds === undefined ||
    modelIds.length === 0 ||
    modelIds.includes(modelId)
  );
};

const providerRank = (provider: string): number => {
  const index = config.ai.providerOrder.indexOf(provider);
  return index === -1 ? config.ai.providerOrder.length : index;
};

const recommendedIds = new Set<string>(config.ai.curatedDefaults);
const disabledIds = new Set<string>(config.ai.disabledModels);

const buildWebChatModels = (
  models: readonly ModelData[]
): AppModelDefinition[] =>
  models
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
    .filter((model) => isWebChatModelAllowed(model.id))
    .toSorted(
      (left, right) =>
        Number(recommendedIds.has(right.apiModelId)) -
          Number(recommendedIds.has(left.apiModelId)) ||
        providerRank(left.owned_by) - providerRank(right.owned_by)
    );

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
