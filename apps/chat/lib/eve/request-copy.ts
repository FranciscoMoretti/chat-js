import { z } from "zod";

import { conversationBinding } from "./contracts";
import { eveCopyInput } from "./copy-input";
import type { EveCopyInput } from "./copy-input";

const keyFor = (ownerId: string, sourceId: string) =>
  `chatjs.eve.pending-copy:${ownerId}:${sourceId.toLowerCase()}`;
type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const preparePendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  sourceConversationId: string,
  modelId: string
) => {
  const key = keyFor(ownerId, sourceConversationId);
  const saved = storage.getItem(key);
  const input = eveCopyInput.parse(
    saved
      ? JSON.parse(saved)
      : { modelId, operationId: crypto.randomUUID(), sourceConversationId }
  );
  if (input.sourceConversationId !== sourceConversationId.toLowerCase()) {
    throw new Error("The saved copy request does not match this conversation.");
  }
  storage.setItem(key, JSON.stringify(input));
  return input;
};

export const finishPendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  input: EveCopyInput
) => {
  const key = keyFor(ownerId, input.sourceConversationId);
  const stored = storage.getItem(key);
  if (
    stored &&
    eveCopyInput.parse(JSON.parse(stored)).operationId === input.operationId
  ) {
    storage.removeItem(key);
  }
};

export class EveCopyRequestError extends Error {
  readonly retryable: boolean;
  readonly conversationId?: string;
  constructor(message: string, retryable = true, conversationId?: string) {
    super(message);
    this.name = "EveCopyRequestError";
    this.retryable = retryable;
    this.conversationId = conversationId;
  }
}

export const requestEveCopy = async (input: EveCopyInput) => {
  const signal = AbortSignal.timeout(45_000);
  try {
    const response = await fetch("/api/agent-conversation-copies", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
    if (!response.ok) {
      const failure = z
        .object({
          conversationId: z.uuid().optional(),
          error: z.string(),
          retryable: z.boolean().optional(),
        })
        .safeParse(await response.json().catch(() => null));
      throw new EveCopyRequestError(
        failure.success
          ? failure.data.error
          : "Unable to save. Sign in and retry the same copy.",
        failure.success ? failure.data.retryable !== false : true,
        failure.success ? failure.data.conversationId : undefined
      );
    }
    return conversationBinding.parse(await response.json());
  } catch (error) {
    if (signal.aborted) {
      throw new EveCopyRequestError(
        "Saving is taking longer than expected. Retry to recover the same copy."
      );
    }
    if (error instanceof EveCopyRequestError) {
      throw error;
    }
    throw new EveCopyRequestError(
      "Saving is unconfirmed. Retry to recover the same copy."
    );
  }
};
