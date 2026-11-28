import { modelSelectorUiItem, modelLogoItem } from "./model-selector-ui";
import { spreadsheetGridItem } from "./spreadsheet-grid";
import { builtInSandboxes } from "./src/sandboxes/catalog";
import type { RegistryItem } from "shadcn/schema";
import { builtInGateways } from "./src/gateways/catalog";
import { pluginItems } from "./src/plugins/catalog";
import { researchItem } from "./src/tools/research";
import { toolDefinitionSchema } from "./metadata";
import { attachWorkspaceFileItem } from "./attach-workspace-file";

const toolItems = (
  [
    {
      dependencies: ["ai", "zod"],
      description: "Generate videos using the selected gateway and storage",
      id: "generate-video",
      agentCategory: "tool",
      requiresChatJS: true,
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
      agentCategory: "tool",
      requiresChatJS: true,
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
        target: `~/chatjs/tools/${definition.id}/${file}`,
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

const registryItems: RegistryItem[] = (
  [
    ...pluginItems,
    ...builtInGateways,
    ...builtInSandboxes,
    ...toolItems,
    attachWorkspaceFileItem,
    spreadsheetGridItem,
    modelLogoItem,
    modelSelectorUiItem,
    researchItem,
  ] satisfies RegistryItem[]
).map((item): RegistryItem => {
  const definition = toolDefinitionSchema.safeParse(item.meta?.chatjs);
  if (!definition.success) {
    return item;
  }
  return {
    ...item,
    meta: {
      ...item.meta,
      chatjs: {
        ...definition.data,
        channelSupport: definition.data.channelSupport ?? {
          web: "supported",
          slack: "unverified",
        },
      },
    },
  };
});
export { registryItems, toolItems };
