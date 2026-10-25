import { feedbackItem } from "./feedback/manifest";
import { projectsItem } from "./projects/manifest";
import { mcpItem } from "./mcp/manifest";
import { attachmentUploadsItem } from "./attachment-uploads/manifest";
import { observabilityItems } from "./observability";

export const pluginItems = [
  projectsItem,
  feedbackItem,
  mcpItem,
  attachmentUploadsItem,
  ...observabilityItems,
];
