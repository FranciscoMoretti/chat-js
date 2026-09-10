import { createConversationInput } from "./contracts";
import type { EveMessageInput } from "./message-input";

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const keyFor = (ownerId: string) => `chatjs.eve.pending:${ownerId}`;

export function prepareCreation(
  storage: StorageAccess,
  ownerId: string,
  draft: EveMessageInput,
  modelId?: string
) {
  const key = keyFor(ownerId);
  const stored = readCreation(storage, ownerId);
  if (stored) {
    return stored;
  }
  const pending = createConversationInput.safeParse({
    operationId: crypto.randomUUID(),
    message: draft,
    modelId,
  });
  if (!pending.success) {
    throw new Error("Enter a message between 1 and 16,000 characters.");
  }
  storage.setItem(key, JSON.stringify(pending.data));
  return pending.data;
}
export function finishCreation(storage: StorageAccess, ownerId: string) {
  storage.removeItem(keyFor(ownerId));
}

export function readCreation(storage: StorageAccess, ownerId: string) {
  const stored = storage.getItem(keyFor(ownerId));
  return stored ? createConversationInput.parse(JSON.parse(stored)) : undefined;
}
