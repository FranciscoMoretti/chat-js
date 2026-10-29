import {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import type { ComposerControl } from "@/components/composer/control";
import { composerControls as installedControls } from "@/composition/generated/installed-composer-controls";
import { composeContributions } from "@/lib/compose-contributions";

// Add local controls here; matching IDs replace installed contributions.
export const composerControls: ComposerControl[] =
  composeContributions<ComposerControl>(
    installedControls,
    [
      { Component: CanvasControl, id: "canvas" },
      { Component: SearchControl, id: "web-search" },
      { Component: ResearchControl, id: "deep-research" },
      { Component: ImageControl, id: "image" },
      { Component: VideoControl, id: "video" },
    ],
    {
      order: [
        "attach-files",
        "take-photo",
        "canvas",
        "web-search",
        "deep-research",
        "image",
        "video",
        "mcp",
      ],
    }
  );
