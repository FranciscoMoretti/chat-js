import type { RegistryItem } from "shadcn/schema";
import { toolDefinitionSchema } from "./metadata";

export const attachWorkspaceFileItem: RegistryItem = {
  name: "attach-workspace-file",
  type: "registry:item",
  description:
    "Attach workspace files to the conversation as downloads, or import earlier files into the workspace for revision.",
  dependencies: ["eve", "zod", "lucide-react"],
  files: [
    "tool.ts",
    "attach.ts",
    "attach-conversation-file.ts",
    "import.ts",
    "schemas.ts",
    "renderer.tsx",
  ].map((file) => ({
    path: `src/tools/attach-workspace-file/${file}`,
    target: `~/chatjs/tools/attach-workspace-file/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      id: "attach-workspace-file",
      kind: "tool",
      agentCategory: "tool",
      requiresChatJS: true,
      requiresStorage: true,
      channelSupport: { web: "supported", slack: "unsupported" },
      tools: [
        { toolExport: "import_file", accounting: "none" },
        {
          toolExport: "attach_workspace_file",
          rendererExport: "AttachWorkspaceFileRenderer",
          accounting: "none",
        },
      ],
    }),
  },
};
