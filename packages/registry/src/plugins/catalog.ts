import { mcpItem } from "./mcp/manifest";
import { attachmentUploadsItem } from "./attachment-uploads/manifest";
import { observabilityItems } from "./observability";

export const pluginItems = [
  mcpItem,
  attachmentUploadsItem,
  ...observabilityItems,
];
