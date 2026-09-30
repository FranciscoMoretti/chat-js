import { Edit3, GlobeIcon, Images, Telescope, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { UiToolName } from "@/lib/ai/types";

interface ToolDefinition {
  icon: LucideIcon;
  name: string;
  shortName: string;
}

export const toolDefinitions: Record<UiToolName, ToolDefinition> = {
  createCodeDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  createSheetDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  createTextDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  deepResearch: {
    icon: Telescope,
    name: "Deep Research",
    shortName: "Research",
  },
  editCodeDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  editSheetDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  editTextDocument: {
    icon: Edit3,
    name: "Canvas",
    shortName: "Canvas",
  },
  generateImage: {
    icon: Images,
    name: "Create an image",
    shortName: "Image",
  },
  generateVideo: {
    icon: Video,
    name: "Create a video",
    shortName: "Video",
  },
  webSearch: {
    icon: GlobeIcon,
    name: "Web Search",
    shortName: "Search",
  },
};
