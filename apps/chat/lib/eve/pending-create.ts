import type { ChatCreationScope } from "@/chatjs/core/chat/contracts";
import { projectCreationScope } from "./project-creation";
import { creationKey } from "./creation-storage";
import type { CreationScope } from "./creation-storage";

import type { EveForkInput, EveForkKind } from "./contracts";
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { UiToolName } from "@/lib/ai/types";
import { createConversationInput } from "./contracts";
import { creationHandler } from "@/chatjs/generated/installed-creation";
import type { SelectedCreation, StorageAccess } from "./creation-contract";
import type { z } from "zod";

type SelectedCreationScope = CreationScope & {
  fork?: Readonly<EveForkInput>;
  forkKind?: EveForkKind;
};

const readCreationFollowUp = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): string => storage.getItem(`${creationKey(ownerId, scope)}:follow-up`) ?? "";

const saveCreationFollowUp = (
  storage: StorageAccess,
  ownerId: string,
  text: string,
  scope?: Readonly<CreationScope>
): void => {
  const key = `${creationKey(ownerId, scope)}:follow-up`;
  if (text) {
    storage.setItem(key, text);
  } else {
    storage.removeItem(key);
  }
};

const hasPendingCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): boolean => {
  const stored = storage.getItem(creationKey(ownerId, scope));
  return stored !== null && stored !== "";
};

const readCreationRequest = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): SelectedCreation | undefined => {
  const stored = storage.getItem(creationKey(ownerId, scope));

  if (stored !== null && stored !== "") {
    return creationHandler.parse(JSON.parse(stored));
  }
  return undefined;
};

const readCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): z.output<typeof createConversationInput> | undefined => {
  const request = readCreationRequest(storage, ownerId, scope);
  if (!request) {
    return undefined;
  }
  const single = createConversationInput.safeParse(request);
  if (!single.success) {
    throw new Error(
      "Recover the saved request before starting another conversation."
    );
  }
  return single.data;
};

const prepareCreation = (
  storage: StorageAccess,
  ownerId: string,
  draft: ReadonlyEveMessageInput,
  modelId?: string,
  context?: Readonly<
    CreationScope & {
      fork?: Readonly<EveForkInput>;
      forkKind?: EveForkKind;
    }
  >,
  selectedTool?: UiToolName,
  creationInput: Readonly<{ projectId?: string }> = {}
): z.output<typeof createConversationInput> => {
  const key = creationKey(ownerId, context);
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
    projectId: creationInput.projectId,
    selectedTool,
  });
  if (!pending.success) {
    throw new Error("Enter a message between 1 and 16,000 characters.");
  }
  storage.setItem(key, JSON.stringify(pending.data));
  return pending.data;
};

const prepareSelectedCreation = (
  storage: StorageAccess,
  ownerId: string,
  draft: ReadonlyEveMessageInput,
  modelIds: readonly string[],
  scope?: Readonly<SelectedCreationScope>,
  selectedTool?: UiToolName,
  creationInput: Readonly<{ projectId?: string }> = {}
): SelectedCreation => {
  const saved = readCreationRequest(storage, ownerId, scope);
  if (saved && !scope?.fork) {
    return saved;
  }
  const request = creationHandler.prepare(
    {
      operationId: saved?.operationId ?? crypto.randomUUID(),
      message: draft,
      fork: scope?.fork,
      forkKind: scope?.forkKind,
      projectId: creationInput.projectId,
      selectedTool,
    },
    modelIds,
    saved
  );
  if (!saved) {
    storage.setItem(creationKey(ownerId, scope), JSON.stringify(request));
  }
  return request;
};

const finishCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): void => {
  storage.removeItem(creationKey(ownerId, scope));
};

/**
 * Moves a definitively rejected project request into New Chat under a fresh operation.
 * @param {StorageAccess} storage Browser storage holding the original project draft and any New Chat draft.
 * @param {string} ownerId Owner whose pending draft namespace must be preserved.
 * @param {string} context Original plugin scope containing the rejected request.
 * @param {string} operationId Original operation checked before moving or deleting its stored draft.
 * @returns {SelectedCreation} A fresh request with the original message/model selection; changed or conflicting drafts throw.
 */
const moveRejectedContextCreation = (
  storage: StorageAccess,
  ownerId: string,
  context: ChatCreationScope,
  operationId: string
): SelectedCreation => {
  const scope = { context };
  const pending = readCreationRequest(storage, ownerId, scope);
  if (
    pending?.operationId !== operationId ||
    projectCreationScope(pending)?.key !== context.key
  ) {
    throw new Error("The saved request changed. Reload before continuing.");
  }
  if (readCreationRequest(storage, ownerId)) {
    throw new Error(
      "Finish the saved request in New Chat before recovering this draft."
    );
  }
  if (readCreationFollowUp(storage, ownerId)) {
    throw new Error(
      "Send or clear the draft in New Chat before recovering this project draft."
    );
  }
  const next = creationHandler.parse({
    ...pending,
    projectId: undefined,
    operationId: crypto.randomUUID(),
  });
  storage.setItem(creationKey(ownerId), JSON.stringify(next));
  const followUp = readCreationFollowUp(storage, ownerId, scope);
  if (followUp) {
    saveCreationFollowUp(storage, ownerId, followUp);
    saveCreationFollowUp(storage, ownerId, "", scope);
  }
  finishCreation(storage, ownerId, scope);
  return next;
};
export {
  hasPendingCreation,
  finishCreation,
  moveRejectedContextCreation,
  prepareCreation,
  prepareSelectedCreation,
  readCreation,
  readCreationRequest,
  readCreationFollowUp,
  saveCreationFollowUp,
};
export type { CreationScope } from "./creation-storage";
