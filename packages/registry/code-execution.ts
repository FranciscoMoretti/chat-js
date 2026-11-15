import type { RegistryItem } from "shadcn/schema";
import { toolDefinitionSchema } from "./metadata";

const codeExecutionRuntimeItem: RegistryItem = {
  files: ["python.ts", "javascript.ts", "types.ts", "sandbox-command.ts"].map(
    (file) => ({
      path: `src/tools/_shared/code-execution/${file}`,
      target: `~/chatjs/tools/_shared/code-execution/${file}`,
      type: "registry:file",
    })
  ),
  name: "code-execution-runtime",
  type: "registry:item",
};

const codeExecutionItem = {
  dependencies: ["ai", "zod"],
  description:
    "Execute Python and JavaScript with the agent’s native EVE sandbox",
  files: ["tool.ts", "renderer.tsx", "schemas.ts"].map((file) => ({
    path: `src/tools/code-execution/${file}`,
    target: `~/chatjs/tools/code-execution/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      codeExecutionCapabilities: {
        cancellation: "eve",
        cleanup: "eve-session",
        files: "session",
        languages: ["python", "javascript"],
        timeout: "bounded",
        usage: "single-receipt",
      },
      codeExecutorExport: "executeCode",
      contractVersion: 1,
      requiresNativeProcesses: true,
      id: "code-execution",
      kind: "tool",
      slot: "codeExecution",
      tools: [{ rendererExport: "CodeExecution", toolExport: "codeExecution" }],
    }),
  },
  name: "code-execution",
  registryDependencies: [
    "@chatjs/code-execution-ui",
    "@chatjs/code-execution-runtime",
  ],
  type: "registry:item",
} satisfies RegistryItem;
export { codeExecutionRuntimeItem, codeExecutionItem };
