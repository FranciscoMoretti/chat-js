type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (ownerId: string, conversationId: string) =>
  `chatjs.eve.comparison-draft:${ownerId}:${conversationId}`;

/** UI intent is separate from the exact replayable server request. */
export const saveComparisonDraftIntent = (
  storage: StorageAccess,
  ownerId: string,
  conversationId: string,
  operationId: string,
  clearComposer: boolean
) => {
  if (clearComposer) {
    storage.setItem(key(ownerId, conversationId), operationId);
  } else {
    storage.removeItem(key(ownerId, conversationId));
  }
};

export const consumeComparisonDraftIntent = (
  storage: StorageAccess,
  ownerId: string,
  conversationId: string,
  operationId: string
): boolean => {
  const clear = storage.getItem(key(ownerId, conversationId)) === operationId;
  storage.removeItem(key(ownerId, conversationId));
  return clear;
};
