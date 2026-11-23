import { definePluginItem } from "../define-item";

const files = ["chat-ui.ts", "viewer-action.tsx"];
export const videoViewerItem = definePluginItem(
  {
    name: "video-viewer",
    title: "Video viewer",
    description:
      "Open video artifacts in a larger player. Optional for video generation.",
    dependencies: ["lucide-react"],
    files: files.map((file) => ({
      path: `src/plugins/video-viewer/src/${file}`,
      target: `~/chatjs/plugins/video-viewer/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
  }
);
