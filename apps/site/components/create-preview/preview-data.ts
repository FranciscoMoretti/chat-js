import type { AppModelDefinition } from "../../../chat/lib/ai/app-models";
import { eveConversationTitleFallback } from "../../../chat/lib/eve/conversation-title";

export const samplePrompt = "Help me build a small app people will love.";
export const sampleGeneratedTitle = "Planning a Small App";

export const sampleConversation = {
  id: "00000000-0000-4000-8000-000000000001",
  title: eveConversationTitleFallback(samplePrompt),
  state: "bound",
};

export const previewModels: AppModelDefinition[] = [
  {
    id: "openai/gpt-5-nano",
    apiModelId: "openai/gpt-5-nano",
    name: "GPT-5 nano",
    owned_by: "openai",
    reasoning: false,
  },
  {
    id: "anthropic/claude-sonnet-4",
    apiModelId: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    owned_by: "anthropic",
    reasoning: true,
  },
].map((model) => ({
  ...model,
  type: "language",
  object: "model",
  description: "Sample model for local preview",
  context_window: 128_000,
  max_tokens: 8192,
  pricing: {},
  input: { text: true, image: true, pdf: true, audio: false, video: false },
  output: { text: true, image: false, audio: false, video: false },
  toolCall: true,
}));
