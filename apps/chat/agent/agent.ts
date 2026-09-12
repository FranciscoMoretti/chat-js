import { defineAgent, defineDynamic } from "eve";
import { defineState } from "eve/context";
import { resolveEveModel } from "../lib/eve/model-selection";

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

export default defineAgent({
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  model: defineDynamic({
    events: {
      "step.started": (_event, context) => {
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        return resolveEveModel(selectedModel.get().modelId);
      },
    },
  }),
  experimental: { workflow: { world: "@workflow/world-postgres" } },
});
