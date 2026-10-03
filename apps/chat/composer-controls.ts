/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named composerControls API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): composerControls remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const composerControls: ComposerControl[] = [
  ...attachmentUploads.controls,
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
  { Component: ConnectorsControl, id: "mcp" },
];
/* oxlint-enable import/no-named-export, import/prefer-default-export */
