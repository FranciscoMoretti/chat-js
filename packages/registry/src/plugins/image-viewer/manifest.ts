import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const files = ["chat-ui.ts", "viewer-action.tsx", "image-modal.tsx"];
export const imageViewerItem: RegistryItem = {
  name: "image-viewer",
  title: "Image viewer",
  type: "registry:item",
  description:
    "Open image artifacts in a full-screen viewer. Optional for image generation.",
  dependencies: ["lucide-react"],
  files: files.map((file) => ({
    path: `src/plugins/image-viewer/src/${file}`,
    target: `~/chatjs/plugins/image-viewer/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 3,
      uiBase: "base",
      id: "image-viewer",
      kind: "plugin",
      files: files.map((file) => `chatjs/plugins/image-viewer/${file}`),
    }),
  },
};
