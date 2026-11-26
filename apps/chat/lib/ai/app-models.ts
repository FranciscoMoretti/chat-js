import { fetchModels } from "./models";
import type { AppModelDefinition } from "./web-chat-models";
import { buildWebChatModels } from "./web-chat-models";

const fetchChatModels = async (): Promise<AppModelDefinition[]> => {
  let models;
  try {
    models = await fetchModels();
  } catch {
    // Discovery logs the failure. Keep the workspace accessible and retry on reload.
    return [];
  }
  return buildWebChatModels(models);
};

export { fetchChatModels };
export type { AppModelDefinition } from "./web-chat-models";
export type { AppModelId } from "./app-model-id";
