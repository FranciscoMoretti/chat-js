import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const files = ["chat-ui.ts", "viewer-action.tsx"];
export const videoViewerItem: RegistryItem = {
  name: "video-viewer",
  title: "Video viewer",
  type: "registry:item",
  description:
    "Open video artifacts in a larger player. Optional for video generation.",
  dependencies: ["lucide-react"],
  files: files.map((file) => ({
    path: `src/plugins/video-viewer/src/${file}`,
    target: `~/chatjs/plugins/video-viewer/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 3,
      uiBase: "base",
      id: "video-viewer",
      kind: "plugin",
      files: files.map((file) => `chatjs/plugins/video-viewer/${file}`),
    }),
  },
};
