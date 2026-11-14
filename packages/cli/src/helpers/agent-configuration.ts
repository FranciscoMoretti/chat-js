import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentConfigurationSchema } from "../../../registry/agent-configuration";

/** Fresh scaffolds only. Subsequent installation must preserve authored agent source. */
export const writeAgentConfiguration = async (
  cwd: string,
  input: unknown
): Promise<void> => {
  const configuration = agentConfigurationSchema.parse(input ?? {});
  const { approval, allowedModels, model, ...nativeOptions } = configuration;
  const modelExpression =
    model === undefined ? "config.ai.workflows.chat" : JSON.stringify(model);
  const approvalExpressions = {
    never: "undefined",
    always: '() => "user-approval"',
    consequential:
      '({ toolAnnotations }) => toolAnnotations?.readOnlyHint === true ? "approved" : "user-approval"',
  };
  const approvalExpression = approvalExpressions[approval];
  await mkdir(path.join(cwd, "agent"), { recursive: true });
  await mkdir(path.join(cwd, "integrations/chat"), { recursive: true });
  await writeFile(
    path.join(cwd, "integrations/chat/models.ts"),
    [
      ...(model === undefined
        ? ['import { config } from "@/lib/config";']
        : []),
      `export const webModels: { readonly model?: string; readonly allowedModels: readonly string[] } = { model: ${modelExpression}, allowedModels: ${JSON.stringify(allowedModels)} };`,
      "",
    ].join("\n")
  );
  await writeFile(
    path.join(cwd, "agent/agent.ts"),
    [
      'import { defineAgent } from "eve";',
      'import { applicationModel } from "../lib/eve/application-model";',
      ...(model === undefined
        ? ['import { config } from "../lib/config";']
        : []),
      'import { configureWorkflowEnvironment } from "../lib/eve/environment";',
      'import { resolveWorkflowWorld } from "../lib/eve/world-config";',
      "configureWorkflowEnvironment(process.env);",
      "export default defineAgent({",
      `  ...${JSON.stringify(nativeOptions)},`,
      `  model: applicationModel(${modelExpression}),`,
      `  approval: ${approvalExpression},`,
      '  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream", "typescript"] },',
      "  experimental: { workflow: { world: resolveWorkflowWorld() } },",
      "});",
      "",
    ].join("\n")
  );
};
