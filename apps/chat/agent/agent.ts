import { defineAgent } from "eve";
import { getActiveGateway } from "../lib/ai/active-gateway";
import { getFallbackModels } from "../lib/ai/gateways/fallback-models";
import { config } from "../lib/config";

const model = getFallbackModels(config.ai.gateway).find(
  (item) => item.id === config.ai.workflows.chat
);
if (!model) {
  throw new Error(
    "Refresh the selected gateway model snapshot before building Eve."
  );
}

export default defineAgent({
  modelContextWindowTokens: model.context_window,
  model: getActiveGateway().createLanguageModel(config.ai.workflows.chat),
  experimental: { workflow: { world: "@workflow/world-postgres" } },
});
