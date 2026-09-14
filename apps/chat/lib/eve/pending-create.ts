import { z } from "zod";

import type { UiToolName } from "../ai/types";
import { createConversationInput } from "./contracts";
import type { EveForkInput, EveForkKind } from "./contracts";
import type { EveMessageInput } from "./message-input";
import { eveResponseGroupInput } from "./response-group-input";

const creationRequest = z.union([
  createConversationInput,
  eveResponseGroupInput,
]);

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

export const readCreationRequest = (
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
) => {
  const stored = storage.getItem(keyFor(ownerId, scope));
  return stored ? creationRequest.parse(JSON.parse(stored)) : undefined;
};

export const prepareResponseGroupCreation = (
  storage: StorageAccess,
  ownerId: string,
  message: EveMessageInput,
  modelIds: string[],
  context?: CreationScope & {
    fork?: EveForkInput;
    forkKind?: Extract<EveForkKind, "comparison" | "edit">;
  },
  selectedTool?: UiToolName
) => {
  const saved = readCreationRequest(storage, ownerId, context);
  if (saved) {
    if (!("modelIds" in saved)) {
      throw new Error(
        "Recover the saved conversation before starting a comparison."
      );
    }
    return saved;
  }
  const request = eveResponseGroupInput.parse({
    fork: context?.fork,
    forkKind: context?.forkKind,
    message,
    modelIds,
    operationId: crypto.randomUUID(),
    projectId: context?.projectId,
    selectedTool,
  });
  storage.setItem(keyFor(ownerId, context), JSON.stringify(request));
  return request;
};

export const readCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
) => {
  const request = readCreationRequest(storage, ownerId, scope);
  if (request && "modelIds" in request) {
    throw new Error(
      "Recover the saved comparison before starting another request."
    );
  }
  return request;
};

export const prepareCreation = (
  storage: StorageAccess,
  ownerId: string,
  draft: EveMessageInput,
  modelId?: string,
  context?: CreationScope & {
    fork?: EveForkInput;
    forkKind?: EveForkKind;
  },
  selectedTool?: UiToolName
) => {
  const key = keyFor(ownerId, context);
  const stored = readCreation(storage, ownerId, context);
  if (stored) {
    return stored;
  }
  const pending = createConversationInput.safeParse({
    fork: context?.fork,
    forkKind: context?.forkKind,
    message: draft,
    modelId,
    operationId: crypto.randomUUID(),
    projectId: context?.projectId,
    selectedTool,
  });
  if (!pending.success) {
    throw new Error("Enter a message between 1 and 16,000 characters.");
  }
  storage.setItem(key, JSON.stringify(pending.data));
  return pending.data;
};

export const prepareSelectedCreation = (
  storage: StorageAccess,
  ownerId: string,
  draft: EveMessageInput,
  modelIds: string[],
  scope?: CreationScope,
  selectedTool?: UiToolName
) => {
  const saved = readCreationRequest(storage, ownerId, scope);
  if (saved) {
    return saved;
  }
  return modelIds.length > 1
    ? prepareResponseGroupCreation(
        storage,
        ownerId,
        draft,
        modelIds,
        scope,
        selectedTool
      )
    : prepareCreation(
        storage,
        ownerId,
        draft,
        modelIds[0],
        scope,
        selectedTool
      );
};
export const finishCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
) => {
  storage.removeItem(keyFor(ownerId, scope));
};

/** Only call after the server definitively rejected the original operation. */
export const moveRejectedProjectCreation = (
  storage: StorageAccess,
  ownerId: string,
  projectId: string,
  operationId: string
) => {
  const scope = { projectId };
  const pending = readCreationRequest(storage, ownerId, scope);
  if (pending?.operationId !== operationId || pending.projectId !== projectId) {
    throw new Error("The saved request changed. Reload before continuing.");
  }
  if (readCreationRequest(storage, ownerId)) {
    throw new Error(
      "Finish the saved request in New Chat before recovering this draft."
    );
  }
  const next =
    "modelIds" in pending
      ? prepareResponseGroupCreation(
          storage,
          ownerId,
          pending.message,
          pending.modelIds,
          undefined,
          pending.selectedTool
        )
      : prepareCreation(
          storage,
          ownerId,
          pending.message,
          pending.modelId,
          undefined,
          pending.selectedTool
        );
  finishCreation(storage, ownerId, scope);
  return next;
};
