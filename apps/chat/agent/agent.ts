import { wrapLanguageModel } from "ai";
import { defineAgent, defineDynamic } from "eve";
import { defineState } from "eve/context";

import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { resolveEveModel } from "../lib/eve/model-selection";
import { researchAvailabilityMiddleware } from "../lib/eve/research-availability";
import { resolveWorkflowWorld } from "../lib/eve/world-config";

configureWorkflowEnvironment(process.env);

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

export default defineAgent({
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  experimental: { workflow: { world: resolveWorkflowWorld() } },
  model: defineDynamic({
    events: {
      "step.started": async (_event, context) => {
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        const resolved = await resolveEveModel(selectedModel.get().modelId);
        return {
          ...resolved,
          model: wrapLanguageModel({
            middleware: researchAvailabilityMiddleware(context.session),
            model: resolved.model,
          }),
        };
      },
    },
  }),
});
