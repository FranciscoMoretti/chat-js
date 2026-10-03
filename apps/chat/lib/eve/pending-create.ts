/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import { z } from "zod";

import type { UiToolName } from "../ai/types";
import { createConversationInput } from "./contracts";
import type { EveForkInput, EveForkKind } from "./contracts";
import type { EveMessageInput } from "./message-input";
import { eveResponseGroupInput } from "./response-group-input";
/* oxlint-enable import/no-relative-parent-imports */

const creationRequest = z.union([
  createConversationInput,
  eveResponseGroupInput,
]);

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CreationScope =
  | { conversationId: string; projectId?: never }
  | { projectId: string; conversationId?: never };

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): keyFor accepts scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): keyFor intentionally keeps the existing falsy-value behavior of scope?.conversationId; scope?.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const keyFor = (ownerId: string, scope?: CreationScope): string => {
  let suffix = "";
  if (scope?.conversationId) {
    suffix = `:fork:${scope.conversationId}`;
  } else if (scope?.projectId) {
    suffix = `:project:${scope.projectId}`;
  }
  return `chatjs.eve.pending:${ownerId}${suffix}`;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-undefined (#519): readCreationRequest uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep readCreationRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readCreationRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): readCreationRequest accepts scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): readCreationRequest intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const readCreationRequest = (
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
) => {
  const stored = storage.getItem(keyFor(ownerId, scope));
  return stored ? creationRequest.parse(JSON.parse(stored)) : undefined;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- max-params (#511): prepareResponseGroupCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep prepareResponseGroupCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep prepareResponseGroupCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): prepareResponseGroupCreation accepts message: EveMessageInput; modelIds: string[]; context?: CreationScope & { fork?: EveForkInput; forkKind?: Extract<EveForkKind, "com; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const prepareResponseGroupCreation = (
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
/* oxlint-enable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- typescript/explicit-function-return-type (#560): Keep readCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): readCreation accepts scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const readCreation = (
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- max-params (#511): prepareCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep prepareCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep prepareCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): prepareCreation accepts draft: EveMessageInput; context?: CreationScope & { fork?: EveForkInput; forkKind?: EveForkKind; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const prepareCreation = (
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
/* oxlint-enable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- max-params (#511): prepareSelectedCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): prepareSelectedCreation uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep prepareSelectedCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep prepareSelectedCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): prepareSelectedCreation accepts draft: EveMessageInput; modelIds: string[]; scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const prepareSelectedCreation = (
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
/* oxlint-enable max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): finishCreation accepts scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const finishCreation = (
  storage: StorageAccess,
  ownerId: string,
  scope?: CreationScope
): void => {
  storage.removeItem(keyFor(ownerId, scope));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-params, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- jsdoc/require-param (#534): moveRejectedProjectCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): moveRejectedProjectCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-params (#511): moveRejectedProjectCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): moveRejectedProjectCreation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep moveRejectedProjectCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep moveRejectedProjectCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** Only call after the server definitively rejected the original operation. */
const moveRejectedProjectCreation = (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-params, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
export {
  finishCreation,
  moveRejectedProjectCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  prepareSelectedCreation,
  readCreation,
  readCreationRequest,
};
export type { CreationScope };
