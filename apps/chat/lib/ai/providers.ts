import type { LanguageModelV4 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type { AppModelId } from "./app-model-id";

import { getActiveGateway } from "./active-gateway";
import { loadEveModelDefinition } from "../eve/model-selection";

const getLanguageModel = async (
  modelId: AppModelId
): Promise<LanguageModelV4> => {
  // This provider is also loaded by authored EVE modules outside Next.js.
  const model = await loadEveModelDefinition(modelId);
  const languageProvider = getActiveGateway().createLanguageModel(
    model.apiModelId
  );

  if (!model.reasoning || model.owned_by !== "xai") {
    return languageProvider;
  }

  return wrapLanguageModel({
    middleware: extractReasoningMiddleware({ tagName: "think" }),
    model: languageProvider,
  });
};

export { getLanguageModel };
