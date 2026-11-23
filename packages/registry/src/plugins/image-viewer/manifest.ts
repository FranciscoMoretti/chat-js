import { definePluginItem } from "../define-item";

const files = ["chat-ui.ts", "viewer-action.tsx", "image-modal.tsx"];
export const imageViewerItem = definePluginItem(
  {
    name: "image-viewer",
    title: "Image viewer",
    description:
      "Open image artifacts in a full-screen viewer. Optional for image generation.",
    dependencies: ["lucide-react"],
    files: files.map((file) => ({
      path: `src/plugins/image-viewer/src/${file}`,
      target: `~/chatjs/plugins/image-viewer/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
  }
);
