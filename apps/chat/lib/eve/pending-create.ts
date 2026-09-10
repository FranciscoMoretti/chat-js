import { createConversationInput } from "./contracts";

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const keyFor = (ownerId: string) => `chatjs.eve.pending:${ownerId}`;

export function prepareCreation(
  storage: StorageAccess,
  ownerId: string,
  draft: string,
  modelId?: string
) {
  const key = keyFor(ownerId);
  const stored = storage.getItem(key);
  if (stored) {
    const pending = createConversationInput.parse(JSON.parse(stored));
    return pending;
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
