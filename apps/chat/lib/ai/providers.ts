import type { LanguageModelMiddleware } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type { AppModelId } from "./app-model-id";

import { devToolsMiddleware } from "@ai-sdk/devtools";
import { getActiveGateway } from "./active-gateway";
import { loadEveModelDefinition } from "../eve/model-selection";

const getLanguageModel = async (
  modelId: AppModelId
): Promise<LanguageModelV4> => {
  const model = await loadEveModelDefinition(modelId);
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
    middleware: middlewares,
    model: languageProvider,
  });
};

export { getLanguageModel };
