/* oxlint-disable import/max-dependencies -- The registry explicitly composes source-owned provider and feature catalogs at its public assembly boundary. */
import { registrySchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";

import {
  codeExecutionRuntimeItem,
  codeExecutionItem,
  daytonaCodeExecutionItem,
} from "./code-execution";
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

const toolItems = (
  [
    {
      dependencies: ["ai", "zod"],
      description: "Generate videos using the selected gateway and storage",
      id: "generate-video",
      requiresGateway: ["video"],
      requiresStorage: true,
      slot: "generateVideo",
      tools: [
        {
          composer: {
            icon: "Video",
            name: "Create a video",
            shortName: "Video",
          },
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
      tools: [
        { rendererExport: "GetWeatherRenderer", toolExport: "getWeather" },
      ],
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
  ] as const
).map(
  ({
    description,
    dependencies,
    ...definition
  }: Readonly<{
    dependencies: readonly string[];
    description: string;
    id: string;
    slot?: string;
    tools: readonly unknown[];
  }>) =>
    ({
      dependencies: [...dependencies],
      description,
      files: [
        "tool.ts",
        "renderer.tsx",
        "schemas.ts",
        ...(definition.id === "generate-image"
          ? [
              "image-model.ts",
              "image-input.ts",
              "image-errors.ts",
              "image-generation.ts",
              "image-request.ts",
            ]
          : []),
      ].map((file) => ({
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

const searchToolItems = (
  [
    { dependency: "@tavily/core", id: "tavily-search", key: "TAVILY_API_KEY" },
    {
      dependency: "@mendable/firecrawl-js",
      id: "firecrawl-search",
      key: "FIRECRAWL_API_KEY",
    },
  ] as const
).map(({ id, dependency, key }) => ({
  dependencies: [
    "ai",
    "zod",
    `${dependency}@${registryPackage.devDependencies[dependency]}`,
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
  name: id as string,
  type: "registry:item" as const,
}));

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
export { codeExecutionItem } from "./code-execution";
export { registry, searchToolItems, toolItems };
