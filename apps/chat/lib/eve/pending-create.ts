import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { EveForkInput, EveForkKind } from "./contracts";
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { UiToolName } from "@/lib/ai/types";
import { createConversationInput } from "./contracts";
import { eveResponseGroupInput } from "./response-group-input";
import { z } from "zod";

const SINGLE_MODEL_COUNT = 1;
const FIRST_MODEL_INDEX = 0;

const creationRequest = z.union([
  createConversationInput,
  eveResponseGroupInput,
]);

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CreationScope =
  | { conversationId: string; projectId?: never }
  | { projectId: string; conversationId?: never };

const keyFor = (ownerId: string, scope?: Readonly<CreationScope>): string => {
  let suffix = "";

  if (scope && isNonEmptyString(scope.conversationId)) {
    suffix = `:fork:${scope.conversationId}`;
  } else if (scope && isNonEmptyString(scope.projectId)) {
    suffix = `:project:${scope.projectId}`;
  }
  return `chatjs.eve.pending:${ownerId}${suffix}`;
};

const hasPendingCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): boolean => {
  const stored = storage.getItem(keyFor(ownerId, scope));
  return stored !== null && stored !== "";
};

const readCreationRequest = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): z.output<typeof creationRequest> | undefined => {
  const stored = storage.getItem(keyFor(ownerId, scope));

  if (stored !== null && stored !== "") {
    return creationRequest.parse(JSON.parse(stored));
  }
  return undefined;
};

const prepareResponseGroupCreation = (
  storage: StorageAccess,
  ownerId: string,
  message: ReadonlyEveMessageInput,
  modelIds: readonly string[],
  context?: Readonly<
    CreationScope & {
      fork?: Readonly<EveForkInput>;
      forkKind?: Extract<EveForkKind, "comparison" | "edit">;
    }
  >,
  selectedTool?: UiToolName
): z.output<typeof eveResponseGroupInput> => {
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

const readCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): z.output<typeof createConversationInput> | undefined => {
  const request = readCreationRequest(storage, ownerId, scope);
  if (request && "modelIds" in request) {
    throw new Error(
      "Recover the saved comparison before starting another request."
    );
  }
  return request;
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
  selectedTool?: UiToolName
): z.output<typeof createConversationInput> => {
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

const prepareSelectedCreation = (
  storage: StorageAccess,
  ownerId: string,
  draft: ReadonlyEveMessageInput,
  modelIds: readonly string[],
  scope?: Readonly<CreationScope>,
  selectedTool?: UiToolName
): z.output<typeof creationRequest> => {
  const saved = readCreationRequest(storage, ownerId, scope);
  if (saved) {
    return saved;
  }

  if (modelIds.length > SINGLE_MODEL_COUNT) {
    return prepareResponseGroupCreation(
      storage,
      ownerId,
      draft,
      modelIds,
      scope,
      selectedTool
    );
  }
  return prepareCreation(
    storage,
    ownerId,
    draft,
    modelIds[FIRST_MODEL_INDEX],
    scope,
    selectedTool
  );
};

const finishCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): void => {
  storage.removeItem(keyFor(ownerId, scope));
};

/**
 * Moves a definitively rejected project request into New Chat under a fresh operation.
 * @param {StorageAccess} storage Browser storage holding the original project draft and any New Chat draft.
 * @param {string} ownerId Owner whose pending draft namespace must be preserved.
 * @param {string} projectId Project scope containing the rejected request.
 * @param {string} operationId Original operation checked before moving or deleting its stored draft.
 * @returns {z.output<typeof creationRequest>} A fresh request with the original message/model selection; changed or conflicting drafts throw.
 */
const moveRejectedProjectCreation = (
  storage: StorageAccess,
  ownerId: string,
  projectId: string,
  operationId: string
): z.output<typeof creationRequest> => {
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
export {
  hasPendingCreation,
  finishCreation,
  moveRejectedProjectCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  prepareSelectedCreation,
  readCreation,
  readCreationRequest,
};
export type { CreationScope };
