import type { ComposerControl } from "@/components/composer/control";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
/* oxlint-enable sort-imports */
// Initial menu order. Reorder or extend this array; chat-js sync preserves it.
import { attachmentUploads } from "@/features/attachment-uploads/integration";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ConnectorsControl } from "@/features/mcp/composer";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (composerControls); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */

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
