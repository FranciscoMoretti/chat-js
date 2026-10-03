import type { ComposerControl } from "@/components/composer/control";
import {
  CanvasControl,
  SearchControl,
  ResearchControl,
  ImageControl,
  VideoControl,
} from "@/components/composer/tool-controls";
// Initial menu order. Reorder or extend this array; chat-js sync preserves it.
import { attachmentUploads } from "@/features/attachment-uploads/integration";
import { ConnectorsControl } from "@/features/mcp/composer";

export const composerControls: ComposerControl[] = [
  ...attachmentUploads.controls,
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
  { Component: ConnectorsControl, id: "mcp" },
];
