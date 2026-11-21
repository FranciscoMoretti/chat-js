import { unstable_cache as cache } from "next/cache";
import { fetchModels } from "./models";
import { buildWebChatModels } from "./web-chat-models";

const fetchChatModels = cache(
  async () => buildWebChatModels(await fetchModels()),
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

export { fetchChatModels };
export type { AppModelDefinition } from "./web-chat-models";
export type { AppModelId } from "./app-model-id";
