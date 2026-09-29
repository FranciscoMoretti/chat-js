import { registrySchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "./metadata";
import registryPackage from "./package.json";
import { builtInGateways } from "./src/gateways/catalog";
import { builtInStorage } from "./src/storage/catalog";
import {
  documentItems,
  savedCodeExecutionItem,
  codeExecutionUiItem,
} from "./src/tools/documents";

export const toolItems = [
  {
    dependencies: ["ai", "zod"],
    description: "Generate videos using the selected gateway and storage",
    id: "generate-video",
    slot: "generateVideo",
    tools: [
      {
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
    slot: "generateImage",
    tools: [
      {
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

export const searchToolItems = [
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
      tools: [{ rendererExport: "WebSearchRenderer", toolExport: "webSearch" }],
    }),
  },
  name: id,
  type: "registry:item" as const,
}));

export const codeExecutionItem = {
  dependencies: [
    "ai",
    "zod",
    `@vercel/oidc@${registryPackage.devDependencies["@vercel/oidc"]}`,
    `@vercel/sandbox@${registryPackage.devDependencies["@vercel/sandbox"]}`,
  ],
  description: "Execute Python and JavaScript with Vercel Sandbox",
  files: [
    "tool.ts",
    "sandbox.ts",
    "python.ts",
    "javascript.ts",
    "types.ts",
    "renderer.tsx",
    "schemas.ts",
  ].map((file) => ({
    path: `src/tools/vercel-code-execution/${file}`,
    target: `~/tools/chatjs/vercel-code-execution/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
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
      savedCodeExecution: true,
      slot: "codeExecution",
      tools: [{ rendererExport: "CodeExecution", toolExport: "codeExecution" }],
    }),
  },
  name: "vercel-code-execution",
  registryDependencies: ["@chatjs/code-execution-ui"],
  type: "registry:item",
} satisfies RegistryItem;

export const registry = registrySchema.parse({
  homepage: "https://chatjs.dev",
  items: [
    ...builtInGateways,
    ...builtInStorage,
    ...toolItems,
    ...documentItems,
    savedCodeExecutionItem,
    codeExecutionUiItem,
    ...searchToolItems,
    codeExecutionItem,
  ],
  name: "chatjs",
});
