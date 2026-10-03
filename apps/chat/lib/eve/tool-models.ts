import { getActiveGateway } from "../ai/active-gateway";
import type { AppModelId } from "../ai/app-model-id";
import type { InstalledGateway } from "../ai/gateways/registry";
import type { ToolModelProvider } from "../ai/tool-context";
import { loadEveModelDefinition } from "./model-selection";

export const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createImageModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #591, #599: Scaffolding replaces InstalledGateway with provider-specific IDs (or never for unsupported media); preserve that generated contract while the null result below handles unsupported models.
      modelId as Parameters<InstalledGateway["createImageModel"]>[0]
    );
    if (!model) {
      throw new Error(
        `Gateway '${gateway.type}' does not support dedicated image models. Use a multimodal language model instead.`
      );
    }
    return model;
  },
  createLanguageModel: (modelId) =>
    getActiveGateway().createLanguageModel(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The installed gateway owns the model-ID contract; encoding it across the dynamic gateway registry requires a coordinated type migration.
      modelId as Parameters<InstalledGateway["createLanguageModel"]>[0]
    ),
  createVideoModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createVideoModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #591, #599: Scaffolding replaces InstalledGateway with provider-specific IDs (or never for unsupported media); preserve that generated contract while the null result below handles unsupported models.
      modelId as Parameters<InstalledGateway["createVideoModel"]>[0]
    );
    if (!model) {
      throw new Error(
        `Gateway '${gateway.type}' does not support video models.`
      );
    }
    return model;
  },
  getModelDefinition: async (modelId) => {
    const model = await loadEveModelDefinition(modelId);
    return {
      apiModelId: model.apiModelId,
      // The EVE catalog and active gateway validate the runtime ID at this boundary.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The installed gateway owns the model-ID contract; encoding it across the dynamic gateway registry requires a coordinated type migration.
      id: model.id as AppModelId,
      output: model.output,
    };
  },
};
