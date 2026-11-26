import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentConfigurationSchema } from "../../../registry/agent-configuration";

/** Fresh scaffolds only. Subsequent installation must preserve authored agent source. */
export const writeAgentConfiguration = async (
  cwd: string,
  input: unknown
): Promise<void> => {
  const configuration = agentConfigurationSchema.parse(input ?? {});
  const { approval, disabledDefaultTools, model, modelIds, ...nativeOptions } =
    configuration;
  const modelExpression =
    model === undefined ? "config.ai.workflows.chat" : JSON.stringify(model);
  const webModelSettings = [
    ...(model === undefined ? [] : [`model: ${modelExpression}`]),
    ...(modelIds === undefined || modelIds.length === 0
      ? []
      : [`modelIds: ${JSON.stringify(modelIds)}`]),
  ];
  const approvalExpressions = {
    never: undefined,
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
      "/** Optional web chat overrides. Omit modelIds to use the gateway catalog. */",
      `export const webModels: { readonly model?: string; readonly modelIds?: readonly string[] } = {${webModelSettings.join(", ")}};`,
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
      "",
      "configureWorkflowEnvironment(process.env);",
      "export default defineAgent({",
      ...Object.entries(nativeOptions).map(
        ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`
      ),
      `  model: applicationModel(${modelExpression}),`,
      ...(approvalExpression === undefined
        ? []
        : [`  approval: ${approvalExpression},`]),
      '  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream", "typescript"] },',
      "  experimental: { workflow: { world: resolveWorkflowWorld() } },",
      "});",
      "",
    ].join("\n")
  );
  if (disabledDefaultTools !== undefined && disabledDefaultTools.length > 0) {
    const toolsDirectory = path.join(cwd, "agent/tools");
    await mkdir(toolsDirectory, { recursive: true });
    await Promise.all(
      disabledDefaultTools.map(async (id) => {
        await writeFile(
          path.join(toolsDirectory, `${id.slice("tool/".length)}.ts`),
          'import { disableTool } from "eve/tools";\n\nexport default disableTool();\n',
          { flag: "wx" }
        );
      })
    );
  }
};
