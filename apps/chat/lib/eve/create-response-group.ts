import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { CreationRejectedError } from "./create-conversation";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { finishCreation, readCreationRequest } from "./pending-create";
/* oxlint-enable sort-imports */
import type { CreationScope } from "./pending-create";
import { eveResponseGroupResult } from "./response-group-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveResponseGroupInput } from "./response-group-input";
/* oxlint-enable sort-imports */

const RESPONSE_GROUP_REQUEST_TIMEOUT_MS = 75_000;
const FIRST_ALTERNATE_CANDIDATE_INDEX = 1;

const recoveryKey = (ownerId: string, groupId: string): string =>
  `chatjs.eve.comparison:${ownerId}:${groupId}`;

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* oxlint-disable no-undefined, typescript/strict-boolean-expressions -- no-undefined (#519): readResponseGroupDraft uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): readResponseGroupDraft intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const readResponseGroupDraft = (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
): z.output<typeof eveResponseGroupInput> | undefined => {
  const saved = storage.getItem(recoveryKey(ownerId, groupId));
  return saved ? eveResponseGroupInput.parse(JSON.parse(saved)) : undefined;
};
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-params --max-params (#511): retainResponseGroupDraft keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.*/
/**
 * Moves unresolved request recovery to its bound group before a new composer request is allowed.
 * @param {StorageAccess} storage Browser storage holding composer requests and group-specific recovery drafts.
 * @param {string} ownerId Owner whose request/recovery namespaces are checked and updated.
 * @param {ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>} operation Original comparison request retained when any candidate remains unresolved.
 * @param {ReadonlyNativeSurface<z.infer<typeof eveResponseGroupResult>>} result Current group candidate states deciding whether recovery remains necessary.
 * @param {Readonly<CreationScope> | undefined} scope Composer scope cleared only when it still holds this same operation.
 */
const retainResponseGroupDraft = (
  storage: StorageAccess,
  ownerId: string,
  operation: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>,
  result: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupResult>>,
  scope?: Readonly<CreationScope>
): void => {
  const unresolved = result.candidates.some(
    (candidate) => candidate.state !== "bound"
  );
  if (unresolved) {
    storage.setItem(recoveryKey(ownerId, result.id), JSON.stringify(operation));
  } else {
    storage.removeItem(recoveryKey(ownerId, result.id));
  }
  if (
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
};
/* oxlint-enable max-params */

const requestResponseGroup = async (
  operation: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>
): Promise<z.output<typeof eveResponseGroupResult>> => {
  const response = await fetch("/api/agent-response-groups", {
    body: JSON.stringify(operation),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(RESPONSE_GROUP_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      "Comparison creation is unconfirmed. Retry the saved request."
    );
  }
  const result = eveResponseGroupResult.parse(await response.json());
  const [primary] = result.candidates;
  if (
    primary?.state === "rejected" &&
    (result.candidates
      .slice(FIRST_ALTERNATE_CANDIDATE_INDEX)
      .every((candidate) => candidate.state === "waiting") ||
      result.candidates.every((candidate) => candidate.state === "rejected"))
  ) {
    throw new CreationRejectedError(
      primary.error,
      primary.code === "project_not_found"
    );
  }
  return result;
};

export {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
};
