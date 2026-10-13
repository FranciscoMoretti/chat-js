import { defineAgent, defineDynamic } from "eve";
import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { defineState } from "eve/context";

import { resolveEveModel } from "../lib/eve/model-selection";
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
import { wrapLanguageModel } from "ai";

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
      "step.started": async (
        _event: unknown,
        context: Readonly<{
          session: Parameters<typeof installedToolAvailabilityMiddleware>[0];
        }>
      ) => {
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        const resolved = await resolveEveModel(selectedModel.get().modelId);
        return {
          ...resolved,
          model: wrapLanguageModel({
            middleware: installedToolAvailabilityMiddleware(context.session),
            model: resolved.model,
          }),
        };
      },
    },
  }),
});
