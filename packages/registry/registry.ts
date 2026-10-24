import { builtInSandboxes } from "./src/sandboxes/catalog";
import { codeExecutionItem, codeExecutionRuntimeItem } from "./code-execution";
import {
  codeExecutionUiItem,
  documentItems,
  savedCodeExecutionItem,
} from "./src/tools/documents";
import type { RegistryItem } from "shadcn/schema";
import { attachmentUploadsItem } from "./src/features/attachment-uploads";
import { builtInGateways } from "./src/gateways/catalog";
import { builtInStorage } from "./src/storage/catalog";
import { mcpItem } from "./src/features/mcp";
import { observabilityItems } from "./src/features/observability";
import registryPackage from "./package.json";
import { registrySchema } from "shadcn/schema";
import { researchItem } from "./src/tools/research";
import { toolDefinitionSchema } from "./metadata";

const toolItems = (
  [
    {
      dependencies: ["ai", "zod"],
      description: "Generate videos using the selected gateway and storage",
      id: "generate-video",
      config: { key: "video" },
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
      config: { key: "image" },
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
    config?: { readonly key: string };
    slot?: string;
    tools: readonly unknown[];
  }>) =>
    ({
      dependencies: [...dependencies],
      description,
      files: [
        ...(definition.config ? ["configuration-schema.ts"] : []),
        ...(definition.id === "retrieve-url" ? ["retrieve-url-env.ts"] : []),
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
      path: `src/tools/${id}/${id}-env.ts`,
      target: `~/tools/chatjs/${id}/${id}-env.ts`,
      type: "registry:file" as const,
    },
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
    ...builtInSandboxes,
    ...builtInStorage,
    ...toolItems,
    ...documentItems,
    savedCodeExecutionItem,
    researchItem,
    codeExecutionUiItem,
    ...searchToolItems,
    codeExecutionItem,
    codeExecutionRuntimeItem,
  ],
  name: "chatjs",
});
export { codeExecutionItem } from "./code-execution";
export { registry, searchToolItems, toolItems };
