import { defineAgent, defineDynamic } from "eve";
import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { defineState } from "eve/context";

import { resolveAccountedEveModel } from "../lib/eve/model-accounting";
import type { DynamicResolveContext } from "eve";
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
import { wrapLanguageModel } from "ai";

configureWorkflowEnvironment(process.env);

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

export default defineAgent({
  // Share Tavily/tokenizer code across the module map and step registration bundles.
  build: {
    externalDependencies: [
      "pino",
      "pino-pretty",
      "thread-stream",
      "@tavily/core",
    ],
  },
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  experimental: { workflow: { world: resolveWorkflowWorld() } },
  model: defineDynamic({
    events: {
      "step.started": async (
        event: unknown,
        context: DynamicResolveContext
      ) => {
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        const resolved = await resolveAccountedEveModel(
          selectedModel.get().modelId,
          event,
          context
        );
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
