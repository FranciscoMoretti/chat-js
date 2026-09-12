import { createConversationInput, type EveForkInput } from "./contracts";
import type { EveMessageInput } from "./message-input";

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type CreationScope =
  | { conversationId: string; projectId?: never }
  | { projectId: string; conversationId?: never };
const keyFor = (ownerId: string, scope?: CreationScope) => {
  let suffix = "";
  if (scope?.conversationId) {
    suffix = `:fork:${scope.conversationId}`;
  } else if (scope?.projectId) {
    suffix = `:project:${scope.projectId}`;
  }
  return `chatjs.eve.pending:${ownerId}${suffix}`;
};

export function prepareCreation(
  storage: StorageAccess,
  ownerId: string,
  draft: EveMessageInput,
  modelId?: string,
  context?: CreationScope & { fork?: EveForkInput }
) {
  const key = keyFor(ownerId, context);
  const stored = readCreation(storage, ownerId, context);
  if (stored) {
    return stored;
  }
  const pending = createConversationInput.safeParse({
    operationId: crypto.randomUUID(),
    message: draft,
    modelId,
    fork: context?.fork,
    projectId: context?.projectId,
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
  scope?: CreationScope
) {
  storage.removeItem(keyFor(ownerId, scope));
}

export function readCreation(
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
) {
  const stored = storage.getItem(keyFor(ownerId, scope));
  return stored ? createConversationInput.parse(JSON.parse(stored)) : undefined;
}

/** Only call after the server definitively rejected the original operation. */
export function moveRejectedProjectCreation(
  storage: StorageAccess,
  ownerId: string,
  projectId: string,
  operationId: string
) {
  const scope = { projectId };
  const pending = readCreation(storage, ownerId, scope);
  if (pending?.operationId !== operationId || pending.projectId !== projectId) {
    throw new Error("The saved request changed. Reload before continuing.");
  }
  if (readCreation(storage, ownerId)) {
    throw new Error(
      "Finish the saved request in New Chat before recovering this draft."
    );
  }
  const next = prepareCreation(
    storage,
    ownerId,
    pending.message,
    pending.modelId
  );
  finishCreation(storage, ownerId, scope);
  return next;
}
