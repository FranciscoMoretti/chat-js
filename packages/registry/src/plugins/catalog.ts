import { aiTitlesItem } from "./ai-titles/manifest";
import { searchItem } from "./search/manifest";
import { followupSuggestionsItem } from "./followup-suggestions/manifest";
import { feedbackItem } from "./feedback/manifest";
import { projectsItem } from "./projects/manifest";
import { mcpItem } from "./mcp/manifest";
import { attachmentUploadsItem } from "./attachment-uploads/manifest";
import { observabilityItems } from "./observability";

export const pluginItems = [
  projectsItem,
  feedbackItem,
  followupSuggestionsItem,
  searchItem,
  aiTitlesItem,
  mcpItem,
  attachmentUploadsItem,
  ...observabilityItems,
];
