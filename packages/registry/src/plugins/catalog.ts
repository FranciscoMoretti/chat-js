import { projectsItem } from "./projects/manifest";
import { mcpItem } from "./mcp/manifest";
import { attachmentUploadsItem } from "./attachment-uploads/manifest";
import { observabilityItems } from "./observability";

export const pluginItems = [
  projectsItem,
  mcpItem,
  attachmentUploadsItem,
  ...observabilityItems,
];
