import {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import type { ComposerControl } from "@/components/composer/control";

export const composerControls: ComposerControl[] = [
  { Component: CanvasControl, id: "canvas" },
  { Component: SearchControl, id: "web-search" },
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
];
