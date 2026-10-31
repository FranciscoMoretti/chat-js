import { isAccountSession } from "../lib/eve/session-identity";
import { requireSessionProfile } from "../lib/eve/session-profile";
import { defineAgent, defineDynamic } from "eve";
import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { defineState } from "eve/context";

import { resolveAccountedEveModel } from "../lib/eve/model-accounting";
import type { DynamicModelContext } from "eve";
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
import { wrapLanguageModel } from "ai";

configureWorkflowEnvironment(process.env);

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

export default defineAgent({
  build: {
    // Graphile's optional TypeScript config loader should load the compiler only
    // when needed, instead of retaining its source in the eager worker bundle.
    externalDependencies: [
      "pino",
      "pino-pretty",
      "thread-stream",
      "typescript",
    ],
  },
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  experimental: { workflow: { world: resolveWorkflowWorld() } },
  model: defineDynamic(async (context: DynamicModelContext) => {
    if (!isAccountSession(context.session)) {
      return await requireSessionProfile(context.session).resolveModel();
    }
    const modelId = context.session.auth.current?.attributes.modelId;
    if (typeof modelId === "string") {
      selectedModel.update(() => ({ modelId }));
    }
    const resolved = await resolveAccountedEveModel(
      selectedModel.get().modelId,
      context
    );
    return {
      ...resolved,
      model: wrapLanguageModel({
        middleware: installedToolAvailabilityMiddleware(context.session),
        model: resolved.model,
      }),
    };
  }),
});
