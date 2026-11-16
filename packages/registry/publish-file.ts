import type { RegistryItem } from "shadcn/schema";
import { toolDefinitionSchema } from "./metadata";

export const publishFileItem: RegistryItem = {
  name: "publish-file",
  type: "registry:item",
  description:
    "Publish downloadable files and import earlier artifacts for chat-driven revisions. Viewers are optional.",
  dependencies: ["eve", "zod", "lucide-react"],
  files: [
    "tool.ts",
    "publish.ts",
    "publish-conversation-file.ts",
    "import.ts",
    "schemas.ts",
    "renderer.tsx",
  ].map((file) => ({
    path: `src/tools/publish-file/${file}`,
    target: `~/chatjs/tools/publish-file/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      id: "publish-file",
      kind: "tool",
      agentCategory: "tool",
      requiresChatJS: true,
      requiresStorage: true,
      channelSupport: { web: "supported", slack: "unsupported" },
      tools: [
        { toolExport: "import_file", accounting: "none" },
        {
          toolExport: "publish_file",
          rendererExport: "PublishFileRenderer",
          accounting: "none",
        },
      ],
    }),
  },
};
