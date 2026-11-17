import {
  ImageControl,
  ResearchControl,
  VideoControl,
} from "@/components/composer/tool-controls";
import type { ComposerControl } from "@/components/composer/control";

export const composerControls: ComposerControl[] = [
  { Component: ResearchControl, id: "deep-research" },
  { Component: ImageControl, id: "image" },
  { Component: VideoControl, id: "video" },
];
