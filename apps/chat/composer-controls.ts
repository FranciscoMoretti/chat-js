import {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import type { ComposerControl } from "@/components/composer/control";
import { mcpClient } from "@/plugins/mcp/client-plugin";
import { attachmentUploadsClient } from "@/plugins/attachment-uploads/client-plugin";
// Initial menu order. Reorder or extend this array; chat-js sync preserves it.

export const composerControls: ComposerControl[] = [
  ...attachmentUploadsClient().composerControls,
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
  ...mcpClient().composerControls,
];
