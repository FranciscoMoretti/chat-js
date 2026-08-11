import type { AppModelId } from "@/lib/ai/app-models";
import { type ChatMessage, getPrimarySelectedModelId } from "@/lib/ai/types";

export type RetryMessageResult =
  | {
      ok: true;
      selectedModelId: AppModelId;
    }
  | {
      ok: false;
      reason:
        | "message_not_found"
        | "model_not_found"
        | "parent_not_found"
        | "parent_not_user";
    };

export function getRetryMessageInput({
  messageId,
  messages,
}: {
  messageId: string;
  messages: ChatMessage[];
}): RetryMessageResult {
  const currentMessage = messages.find((message) => message.id === messageId);
  if (!currentMessage) {
    return { ok: false, reason: "message_not_found" };
  }

  const currentMessageIndex = messages.findIndex(
    (message) => message.id === messageId
  );
  const parentMessageId = currentMessage.metadata?.parentMessageId ?? null;
  const parentMessageIndex = parentMessageId
    ? messages.findIndex((message) => message.id === parentMessageId)
    : currentMessageIndex - 1;

  if (parentMessageIndex < 0) {
    return { ok: false, reason: "parent_not_found" };
  }

  const parentMessage = messages[parentMessageIndex];
  if (parentMessage.role !== "user") {
    return { ok: false, reason: "parent_not_user" };
  }

  const retryModelId =
    getPrimarySelectedModelId(currentMessage.metadata?.selectedModel) ||
    getPrimarySelectedModelId(parentMessage.metadata?.selectedModel);

  if (!retryModelId) {
    return { ok: false, reason: "model_not_found" };
  }

  return {
    ok: true,
    selectedModelId: retryModelId as AppModelId,
  };
}
