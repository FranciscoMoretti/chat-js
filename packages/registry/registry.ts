import { registrySchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "./metadata";
import registryPackage from "./package.json";
import { attachmentUploadsItem } from "./src/features/attachment-uploads";
import { mcpItem } from "./src/features/mcp";
import { observabilityItems } from "./src/features/observability";
import { builtInGateways } from "./src/gateways/catalog";
import { builtInStorage } from "./src/storage/catalog";
import {
  documentItems,
  savedCodeExecutionItem,
  codeExecutionUiItem,
} from "./src/tools/documents";
import { researchItem } from "./src/tools/research";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toolItems = [
  {
    dependencies: ["ai", "zod"],
    description: "Generate videos using the selected gateway and storage",
    id: "generate-video",
    requiresGateway: ["video"],
    requiresStorage: true,
    slot: "generateVideo",
    tools: [
      {
        composer: { icon: "Video", name: "Create a video", shortName: "Video" },
        rendererExport: "GenerateVideoRenderer",
        toolExport: "generateVideoTool",
      },
    ],
  },
  {
    dependencies: ["ai", "zod", "lucide-react"],
    description:
      "Generate and edit images using the selected gateway and storage",
    id: "generate-image",
    requiresGateway: ["image"],
    requiresStorage: true,
    slot: "generateImage",
    tools: [
      {
        composer: {
          icon: "Images",
          name: "Create an image",
          shortName: "Image",
        },
        rendererExport: "GenerateImageRenderer",
        toolExport: "generateImageTool",
      },
    ],
  },
  {
    dependencies: ["ai", "zod"],
    description: "Count words, characters, and sentences in text",
    id: "word-count",
    tools: [{ rendererExport: "WordCountRenderer", toolExport: "wordCount" }],
  },
  {
    dependencies: ["ai", "zod", "date-fns"],
    description: "Get the current weather at a location",
    id: "get-weather",
    tools: [{ rendererExport: "GetWeatherRenderer", toolExport: "getWeather" }],
  },
  {
    dependencies: ["ai", "zod", "@mendable/firecrawl-js"],
    description: "Fetch structured information from a single URL",
    envRequirements: [{ options: [["FIRECRAWL_API_KEY"]] }],
    id: "retrieve-url",
    slot: "retrieveUrl",
    tools: [
      { rendererExport: "RetrieveUrlRenderer", toolExport: "retrieveUrl" },
    ],
  },
].map(
  ({ description, dependencies, ...definition }) =>
    ({
      dependencies,
      description,
      files: ["tool.ts", "renderer.tsx", "schemas.ts"].map((file) => ({
        path: `src/tools/${definition.id}/${file}`,
        target: `~/tools/chatjs/${definition.id}/${file}`,
        type: "registry:file",
      })),
      meta: {
        chatjs: toolDefinitionSchema.parse({
          contractVersion: 1,
          ...definition,
          kind: "tool",
        }),
      },
      name: definition.id,
      type: "registry:item",
    }) satisfies RegistryItem
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const searchToolItems = [
  { dependency: "@tavily/core", id: "tavily-search", key: "TAVILY_API_KEY" },
  {
    dependency: "@mendable/firecrawl-js",
    id: "firecrawl-search",
    key: "FIRECRAWL_API_KEY",
  },
].map(({ id, dependency, key }) => ({
  dependencies: [
    "ai",
    "zod",
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- These dependency names come from the registry package catalog; the indexed access preserves their pinned versions.
    `${dependency}@${registryPackage.devDependencies[dependency as "@tavily/core" | "@mendable/firecrawl-js"]}`,
  ],
  description: `Use ${id} for chat and deep research`,
  files: [
    {
      path: `src/tools/${id}/tool.ts`,
      target: `~/tools/chatjs/${id}/tool.ts`,
      type: "registry:file" as const,
    },
    {
      path: `src/tools/${id}/renderer.tsx`,
      target: `~/tools/chatjs/${id}/renderer.tsx`,
      type: "registry:file" as const,
    },
    {
      path: `src/tools/${id}/schemas.ts`,
      target: `~/tools/chatjs/${id}/schemas.ts`,
      type: "registry:file" as const,
    },
  ],
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      envRequirements: [{ options: [[key]] }],
      id,
      kind: "tool",
      slot: "webSearch",
      tools: [
        {
          composer: {
            icon: "Globe",
            name: "Web Search",
            shortName: "Search",
          },
          rendererExport: "WebSearchRenderer",
          toolExport: "webSearch",
        },
      ],
    }),
  },
  name: id,
  type: "registry:item" as const,
}));
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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

const registry = registrySchema.parse({
  homepage: "https://chatjs.dev",
  items: [
    mcpItem,
    attachmentUploadsItem,
    ...observabilityItems,
    ...builtInGateways,
    ...builtInStorage,
    ...toolItems,
    ...documentItems,
    savedCodeExecutionItem,
    researchItem,
    codeExecutionUiItem,
    ...searchToolItems,
    codeExecutionItem,
    codeExecutionRuntimeItem,
    daytonaCodeExecutionItem,
  ],
  name: "chatjs",
});
export { codeExecutionItem, registry, searchToolItems, toolItems };
