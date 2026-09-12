import { registrySchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "./metadata";
import registryPackage from "./package.json";
import { builtInGateways } from "./src/gateways/catalog";
import { builtInStorage } from "./src/storage/catalog";

export const toolItems = [
  {
    dependencies: ["ai", "zod"],
    description: "Count words, characters, and sentences in text",
    id: "word-count",
    rendererExport: "WordCountRenderer",
    toolExport: "wordCount",
  },
  {
    dependencies: ["ai", "zod", "date-fns"],
    description: "Get the current weather at a location",
    id: "get-weather",
    rendererExport: "GetWeatherRenderer",
    toolExport: "getWeather",
  },
  {
    dependencies: ["ai", "zod", "@mendable/firecrawl-js"],
    description: "Fetch structured information from a single URL",
    envRequirements: [{ options: [["FIRECRAWL_API_KEY"]] }],
    id: "retrieve-url",
    rendererExport: "RetrieveUrlRenderer",
    slot: "retrieveUrl",
    toolExport: "retrieveUrl",
  },
].map(
  ({ description, dependencies, ...definition }) =>
    ({
      dependencies,
      description,
      files: ["tool.ts", "renderer.tsx"].map((file) => ({
        path: `src/tools/${definition.id}/${file}`,
        target: `~/tools/chatjs/${definition.id}/${file}`,
        type: "registry:file",
      })),
      meta: {
        chatjs: toolDefinitionSchema.parse({
          ...definition,
          contractVersion: 1,
          kind: "tool",
        }),
      },
      name: definition.id,
      registryDependencies: ["@chatjs/toolkit-renderer"],
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
  ],
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      envRequirements: [{ options: [[key]] }],
      id,
      kind: "tool",
      rendererExport: "WebSearchRenderer",
      slot: "webSearch",
      toolExport: "webSearch",
    }),
  },
  name: id,
  type: "registry:item" as const,
}));

export const codeExecutionItem = {
  dependencies: [
    "ai",
    "zod",
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
        },
      ],
      id: "vercel-code-execution",
      kind: "tool",
      rendererExport: "CodeExecution",
      slot: "codeExecution",
      toolExport: "codeExecution",
    }),
  },
  name: "vercel-code-execution",
  type: "registry:item",
} satisfies RegistryItem;

export const registry = registrySchema.parse({
  homepage: "https://chatjs.dev",
  items: [
    ...builtInGateways,
    ...builtInStorage,
    ...toolItems,
    ...searchToolItems,
    codeExecutionItem,
    {
      dependencies: ["ai"],
      files: [["tool-part.ts", "lib/tool-part.ts"]].map(([source, target]) => ({
        path: `src/tools/toolkit-renderer/${source}`,
        target: `~/tools/chatjs/_shared/${target}`,
        type: "registry:file",
      })),
      name: "toolkit-renderer",
      type: "registry:item",
    },
  ],
  name: "chatjs",
});
