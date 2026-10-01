// Initial menu order. Reorder or extend this array; chat-js sync preserves it.
import {
  AttachFilesControl,
  TakePhotoControl,
} from "@/components/composer/attachment-controls";
import type { ComposerControl } from "@/components/composer/control";
import {
  CanvasControl,
  SearchControl,
  ResearchControl,
  ImageControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import { ConnectorsControl } from "@/features/mcp/composer";

export const composerControls: ComposerControl[] = [
  { Component: AttachFilesControl, id: "attach-files" },
  { Component: TakePhotoControl, id: "take-photo" },
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
  { Component: ConnectorsControl, id: "mcp" },
];
