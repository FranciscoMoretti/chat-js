import { defineAgent, defineDynamic } from "eve";
import { resolveEveModel } from "../lib/eve/model-selection";

export default defineAgent({
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  model: defineDynamic({
    events: {
      "step.started": (_event, context) => {
        const modelId = context.session.auth.current?.attributes.modelId;
        return resolveEveModel(
          typeof modelId === "string" ? modelId : undefined
        );
      },
    },
  }),
  experimental: { workflow: { world: "@workflow/world-postgres" } },
});
