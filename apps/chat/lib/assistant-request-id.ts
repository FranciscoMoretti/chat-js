import { v5 as uuidv5 } from "uuid";
import type { AppModelId } from "@/lib/ai/app-model-id";

const ASSISTANT_REQUEST_NAMESPACE = uuidv5(
  "chat-js:assistant-request",
  uuidv5.URL
);

export function createAssistantRequestMessageId({
  chatId,
  parallelGroupId,
  parallelIndex,
  requestId,
  selectedModelId,
  userMessageId,
}: {
  chatId: string;
  parallelGroupId: string | null;
  parallelIndex: number | null;
  requestId: string;
  selectedModelId: AppModelId;
  userMessageId: string;
}) {
  return uuidv5(
    JSON.stringify([
      chatId,
      userMessageId,
      requestId,
      selectedModelId,
      parallelGroupId,
      parallelIndex,
    ]),
    ASSISTANT_REQUEST_NAMESPACE
  );
}
