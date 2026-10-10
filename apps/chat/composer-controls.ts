import {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import type { ComposerControl } from "@/components/composer/control";
import { ConnectorsControl } from "@/features/mcp/composer";
import { attachmentUploads } from "@/features/attachment-uploads/integration";
// Initial menu order. Reorder or extend this array; chat-js sync preserves it.
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (composerControls); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export const composerControls: ComposerControl[] = [
  ...attachmentUploads.controls,
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
  { Component: ConnectorsControl, id: "mcp" },
];
/* oxlint-enable import/prefer-default-export, import/no-named-export */
