import type { RegistryItem } from "shadcn/schema";
import { toolDefinitionSchema } from "./metadata";

const codeExecutionRuntimeItem: RegistryItem = {
  files: ["python.ts", "javascript.ts", "types.ts"].map((file) => ({
    path: `src/tools/_shared/code-execution/${file}`,
    target: `~/chatjs/tools/_shared/code-execution/${file}`,
    type: "registry:file",
  })),
  name: "code-execution-runtime",
  type: "registry:item",
};

const codeExecutionItem = {
  dependencies: ["ai", "zod"],
  description:
    "Execute Python and JavaScript with the selected sandbox provider",
  files: ["tool.ts", "renderer.tsx", "schemas.ts"].map((file) => ({
    path: `src/tools/code-execution/${file}`,
    target: `~/chatjs/tools/code-execution/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      codeExecutionCapabilities: {
        cancellation: "terminate",
        cleanup: "durable-allocation",
        files: "ephemeral",
        languages: ["python", "javascript"],
        timeout: "bounded",
        usage: "single-receipt",
      },
      codeExecutorExport: "executeCode",
      contractVersion: 1,
      requiresSandbox: true,
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
