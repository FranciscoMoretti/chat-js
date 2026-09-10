import { createConversationInput, type EveForkInput } from "./contracts";
import type { EveMessageInput } from "./message-input";

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const keyFor = (ownerId: string, conversationId?: string) =>
  `chatjs.eve.pending:${ownerId}${conversationId ? `:fork:${conversationId}` : ""}`;

export function prepareCreation(
  storage: StorageAccess,
  ownerId: string,
  draft: EveMessageInput,
  modelId?: string,
  context?: { conversationId: string; fork: EveForkInput }
) {
  const key = keyFor(ownerId, context?.conversationId);
  const stored = readCreation(storage, ownerId, context?.conversationId);
  if (stored) {
    return stored;
  }
  const pending = createConversationInput.safeParse({
    operationId: crypto.randomUUID(),
    message: draft,
    modelId,
    fork: context?.fork,
  });
  if (!pending.success) {
    throw new Error("Enter a message between 1 and 16,000 characters.");
  }
  storage.setItem(key, JSON.stringify(pending.data));
  return pending.data;
}
export function finishCreation(
  storage: StorageAccess,
  ownerId: string,
  conversationId?: string
) {
  storage.removeItem(keyFor(ownerId, conversationId));
}

export function readCreation(
  storage: StorageAccess,
  ownerId: string,
  conversationId?: string
) {
  const stored = storage.getItem(keyFor(ownerId, conversationId));
  return stored ? createConversationInput.parse(JSON.parse(stored)) : undefined;
}
