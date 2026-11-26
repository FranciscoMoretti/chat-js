import { defineAgent } from "eve";
import { applicationModel } from "../lib/eve/application-model";
import { config } from "../lib/config";
import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { resolveWorkflowWorld } from "../lib/eve/world-config";

configureWorkflowEnvironment(process.env);

export default defineAgent({
  model: applicationModel(config.ai.workflows.chat),
  reasoning: "provider-default",
  defaultTools: true,
  build: {
    externalDependencies: [
      "pino",
      "pino-pretty",
      "thread-stream",
      "typescript",
    ],
  },
  experimental: { workflow: { world: resolveWorkflowWorld() } },
});
