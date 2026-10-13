import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { ToolModelProvider } from "@/lib/ai/tool-context";

import { loadEveModelDefinition } from "./model-selection";

export const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    if (gateway.createImageModel === null) {
      throw new Error(
        `Gateway '${gateway.type}' does not support dedicated image models. Use a multimodal language model instead.`
      );
    }
    return gateway.createImageModel(modelId);
  },
  createLanguageModel: (modelId) =>
    getActiveGateway().createLanguageModel(modelId),
  createVideoModel: (modelId) => {
    const gateway = getActiveGateway();
    if (gateway.createVideoModel === null) {
      throw new Error(
        `Gateway '${gateway.type}' does not support video models.`
      );
    }
    return gateway.createVideoModel(modelId);
  },
  getModelDefinition: async (modelId) => {
    const model = await loadEveModelDefinition(modelId);
    return {
      apiModelId: model.apiModelId,
      // Catalog resolution separates application IDs from provider API IDs.
      id: model.id,
      output: model.output,
    };
  },
};
