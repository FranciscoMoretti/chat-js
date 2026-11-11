import { eveConversationTitleFallback } from "../../../chat/lib/eve/conversation-title";

export const samplePrompt = "Help me build a small app people will love.";
export const sampleGeneratedTitle = "Planning a Small App";

export const sampleConversation = {
  id: "00000000-0000-4000-8000-000000000001",
  title: eveConversationTitleFallback(samplePrompt),
  state: "bound",
};
