import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */

import { createConversationInput } from "./contracts";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveForkInput, EveForkKind } from "./contracts";
/* oxlint-enable sort-imports */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import { eveResponseGroupInput } from "./response-group-input";

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

/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): keyFor intentionally keeps the existing falsy-value behavior of scope?.conversationId; scope?.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const keyFor = (ownerId: string, scope?: Readonly<CreationScope>): string => {
  let suffix = "";
  if (scope?.conversationId) {
    suffix = `:fork:${scope.conversationId}`;
  } else if (scope?.projectId) {
    suffix = `:project:${scope.projectId}`;
  }
  return `chatjs.eve.pending:${ownerId}${suffix}`;
};
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable no-undefined, typescript/strict-boolean-expressions -- no-undefined (#519): readCreationRequest uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): readCreationRequest intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const readCreationRequest = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): z.output<typeof creationRequest> | undefined => {
  const stored = storage.getItem(keyFor(ownerId, scope));
  return stored ? creationRequest.parse(JSON.parse(stored)) : undefined;
};
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-params -- max-params (#511): prepareResponseGroupCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.*/
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
/* oxlint-enable max-params */

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

/* oxlint-disable max-params -- max-params (#511): prepareCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.*/
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
/* oxlint-enable max-params */

/* oxlint-disable max-params -- max-params (#511): prepareSelectedCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.*/
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
  return modelIds.length > SINGLE_MODEL_COUNT
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
        modelIds[FIRST_MODEL_INDEX],
        scope,
        selectedTool
      );
};
/* oxlint-enable max-params */

const finishCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: Readonly<CreationScope>
): void => {
  storage.removeItem(keyFor(ownerId, scope));
};

/* oxlint-disable max-params, no-undefined --max-params (#511): moveRejectedProjectCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): moveRejectedProjectCreation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.*/
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (finishCreation, moveRejectedProjectCreation, prepareCreation, prepareResponseGroupCreation, prepareSelectedCreation, readCreation, readCreationRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-params, no-undefined */
export {
  finishCreation,
  moveRejectedProjectCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  prepareSelectedCreation,
  readCreation,
  readCreationRequest,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CreationScope); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { CreationScope };
/* oxlint-enable import/no-named-export */
