import { registrySchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "./metadata";
import registryPackage from "./package.json";
import { builtInGateways } from "./src/gateways/catalog";
import { builtInStorage } from "./src/storage/catalog";

export const toolItems = [
  {
    id: "word-count",
    toolExport: "wordCount",
    rendererExport: "WordCountRenderer",
    description: "Count words, characters, and sentences in text",
    dependencies: ["ai", "zod"],
  },
  {
    id: "get-weather",
    toolExport: "getWeather",
    rendererExport: "GetWeatherRenderer",
    description: "Get the current weather at a location",
    dependencies: ["ai", "zod", "date-fns"],
  },
  {
    id: "retrieve-url",
    slot: "retrieveUrl",
    toolExport: "retrieveUrl",
    rendererExport: "RetrieveUrlRenderer",
    description: "Fetch structured information from a single URL",
    dependencies: ["ai", "zod", "@mendable/firecrawl-js"],
    envRequirements: [{ options: [["FIRECRAWL_API_KEY"]] }],
  },
].map(
  ({ description, dependencies, ...definition }) =>
    ({
      name: definition.id,
      type: "registry:item",
      description,
      dependencies,
      registryDependencies: ["@chatjs/toolkit-renderer"],
      meta: {
        chatjs: toolDefinitionSchema.parse({
          ...definition,
          contractVersion: 1,
          kind: "tool",
        }),
      },
      files: ["tool.ts", "renderer.tsx"].map((file) => ({
        path: `src/tools/${definition.id}/${file}`,
        type: "registry:file",
        target: `~/tools/chatjs/${definition.id}/${file}`,
      })),
    }) satisfies RegistryItem
);

export const searchToolItems = [
  { id: "tavily-search", dependency: "@tavily/core", key: "TAVILY_API_KEY" },
  {
    id: "firecrawl-search",
    dependency: "@mendable/firecrawl-js",
    key: "FIRECRAWL_API_KEY",
  },
].map(({ id, dependency, key }) => ({
  name: id,
  type: "registry:item" as const,
  description: `Use ${id} for chat and deep research`,
  dependencies: [
    "ai",
    "zod",
    `${dependency}@${registryPackage.devDependencies[dependency as "@tavily/core" | "@mendable/firecrawl-js"]}`,
  ],
  files: [
    {
      path: `src/tools/${id}/tool.ts`,
      type: "registry:file" as const,
      target: `~/tools/chatjs/${id}/tool.ts`,
    },
    {
      path: `src/tools/${id}/renderer.tsx`,
      type: "registry:file" as const,
      target: `~/tools/chatjs/${id}/renderer.tsx`,
    },
  ],
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      kind: "tool",
      id,
      slot: "webSearch",
      toolExport: "webSearch",
      rendererExport: "WebSearchRenderer",
      envRequirements: [{ options: [[key]] }],
    }),
  },
}));

export const codeExecutionItem = {
  name: "vercel-code-execution",
  type: "registry:item",
  description: "Execute Python and JavaScript with Vercel Sandbox",
  dependencies: [
    "ai",
    "zod",
    `@vercel/sandbox@${registryPackage.devDependencies["@vercel/sandbox"]}`,
  ],
  files: [
    "tool.ts",
    "sandbox.ts",
    "python.ts",
    "javascript.ts",
    "types.ts",
    "renderer.tsx",
  ].map((file) => ({
    path: `src/tools/vercel-code-execution/${file}`,
    type: "registry:file" as const,
    target: `~/tools/chatjs/vercel-code-execution/${file}`,
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      kind: "tool",
      id: "vercel-code-execution",
      slot: "codeExecution",
      toolExport: "codeExecution",
      rendererExport: "CodeExecution",
      envRequirements: [
        {
          options: [
            ["VERCEL_OIDC_TOKEN"],
            ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
          ],
          description: "Vercel OIDC or team/project/token credentials",
        },
      ],
    }),
  },
} satisfies RegistryItem;

export const registry = registrySchema.parse({
  name: "chatjs",
  homepage: "https://chatjs.dev",
  items: [
    ...builtInGateways,
    ...builtInStorage,
    ...toolItems,
    ...searchToolItems,
    codeExecutionItem,
    {
      name: "toolkit-renderer",
      type: "registry:item",
      dependencies: ["ai"],
      files: [["tool-part.ts", "lib/tool-part.ts"]].map(([source, target]) => ({
        path: `src/tools/toolkit-renderer/${source}`,
        type: "registry:file",
        target: `~/tools/chatjs/_shared/${target}`,
      })),
    },
  ],
});
