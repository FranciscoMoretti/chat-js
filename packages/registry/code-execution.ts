import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "./metadata";
import registryPackage from "./package.json";

const codeExecutionRuntimeItem: RegistryItem = {
  files: ["python.ts", "javascript.ts", "types.ts"].map((file) => ({
    path: `src/tools/_shared/code-execution/${file}`,
    target: `~/tools/chatjs/_shared/code-execution/${file}`,
    type: "registry:file",
  })),
  name: "code-execution-runtime",
  type: "registry:item",
};

const codeExecutionItem = {
  dependencies: [
    "ai",
    "zod",
    `@vercel/oidc@${registryPackage.devDependencies["@vercel/oidc"]}`,
    `@vercel/sandbox@${registryPackage.devDependencies["@vercel/sandbox"]}`,
  ],
  description: "Execute Python and JavaScript with Vercel Sandbox",
  files: ["tool.ts", "execution-sandbox.ts", "renderer.tsx", "schemas.ts"].map(
    (file) => ({
      path: `src/tools/vercel-code-execution/${file}`,
      target: `~/tools/chatjs/vercel-code-execution/${file}`,
      type: "registry:file" as const,
    })
  ),
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
      envRequirements: [
        {
          description: "Vercel OIDC or team/project/token credentials",
          options: [
            ["VERCEL_OIDC_TOKEN"],
            ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
          ],
          runtimeAuth: "vercel-oidc",
        },
      ],
      id: "vercel-code-execution",
      kind: "tool",
      slot: "codeExecution",
      tools: [{ rendererExport: "CodeExecution", toolExport: "codeExecution" }],
    }),
  },
  name: "vercel-code-execution",
  registryDependencies: [
    "@chatjs/code-execution-ui",
    "@chatjs/code-execution-runtime",
  ],
  type: "registry:item",
} satisfies RegistryItem;

const daytonaCodeExecutionItem: RegistryItem = {
  dependencies: [
    `@daytona/sdk@${registryPackage.devDependencies["@daytona/sdk"]}`,
    "zod",
  ],
  description: "Execute Python and JavaScript with Daytona",
  files: [
    ...["tool.ts", "sandbox.ts", "schemas.ts", "execution.ts"].map((file) => ({
      path: `src/tools/daytona-code-execution/${file}`,
      target: `~/tools/chatjs/daytona-code-execution/${file}`,
      type: "registry:file" as const,
    })),
    {
      path: "src/tools/vercel-code-execution/renderer.tsx",
      target: "~/tools/chatjs/daytona-code-execution/renderer.tsx",
      type: "registry:file",
    },
  ],
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
      envRequirements: [
        { options: [["DAYTONA_API_KEY", "DAYTONA_ORGANIZATION_ID"]] },
      ],
      id: "daytona-code-execution",
      kind: "tool",
      slot: "codeExecution",
      tools: [{ rendererExport: "CodeExecution", toolExport: "codeExecution" }],
    }),
  },
  name: "daytona-code-execution",
  registryDependencies: [
    "@chatjs/code-execution-ui",
    "@chatjs/code-execution-runtime",
  ],
  type: "registry:item",
};

export {
  codeExecutionRuntimeItem,
  codeExecutionItem,
  daytonaCodeExecutionItem,
};
