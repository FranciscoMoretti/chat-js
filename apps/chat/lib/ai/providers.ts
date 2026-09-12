import { devToolsMiddleware } from "@ai-sdk/devtools";
import { getModelProviderOptions as modelProviderOptions } from "@chat-js/gateways/provider-options";
import {
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import type { LanguageModelMiddleware } from "ai";

import { getActiveGateway } from "./active-gateway";
import type { AppModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";

export const getLanguageModel = async (modelId: AppModelId) => {
  const model = await getAppModelDefinition(modelId);
  const languageProvider = getActiveGateway().createLanguageModel(
    model.apiModelId
  );

  const middlewares: LanguageModelMiddleware[] = [];

  // Add devtools middleware in development
  if (process.env.NODE_ENV === "development") {
    middlewares.push(devToolsMiddleware());
  }

  // Add reasoning middleware if the model supports reasoning
  if (model.reasoning && model.owned_by === "xai") {
    middlewares.push(extractReasoningMiddleware({ tagName: "think" }));
  }

  if (middlewares.length === 0) {
    return languageProvider;
  }

  return wrapLanguageModel({
    model: languageProvider,
    middleware: middlewares,
  });
};

export const getImageModel = (modelId: string) => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (!imageModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};

export const getVideoModel = (modelId: string) => {
  const videoModel = getActiveGateway().createVideoModel(modelId);
  if (!videoModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support video models.`
    );
  }
  return videoModel;
};

// Get a multimodal language model that can generate images via generateText
export const getMultimodalImageModel = (modelId: string) =>
  getActiveGateway().createLanguageModel(modelId);

// Model aliases removed - use getLanguageModel directly with specific model IDs

export const getModelProviderOptions = async (providerModelId: AppModelId) =>
  modelProviderOptions(await getAppModelDefinition(providerModelId));
