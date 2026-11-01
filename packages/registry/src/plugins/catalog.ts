import { guestChatItem } from "./guest-chat/manifest";
import { desktopItem } from "./desktop/manifest";
import { creditsItem } from "./credits/manifest";
import { modelPreferencesItem } from "./model-preferences/manifest";
import { sharingItem } from "./sharing/manifest";
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
  desktopItem,
  creditsItem,
  guestChatItem,
  modelPreferencesItem,
  aiTitlesItem,
  sharingItem,
  mcpItem,
  attachmentUploadsItem,
  ...observabilityItems,
];
