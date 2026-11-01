import type { z } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { CreationRejectedError } from "./create-conversation";
import { finishCreation, readCreationRequest } from "./pending-create";
import type { CreationScope } from "./pending-create";
import { eveResponseGroupResult } from "./response-group-contracts";
import { eveResponseGroupInput } from "./response-group-input";

const RESPONSE_GROUP_REQUEST_TIMEOUT_MS = 75_000;
const FIRST_ALTERNATE_CANDIDATE_INDEX = 1;

const recoveryKey = (ownerId: string, groupId: string): string =>
  `chatjs.eve.comparison:${ownerId}:${groupId}`;

const progressKey = (ownerId: string, groupId: string): string =>
  `${recoveryKey(ownerId, groupId)}:progress`;

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const readResponseGroupDraft = (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
): z.output<typeof eveResponseGroupInput> | undefined => {
  const saved = storage.getItem(recoveryKey(ownerId, groupId));

  if (saved !== null && saved !== "") {
    return eveResponseGroupInput.parse(JSON.parse(saved));
  }
  return undefined;
};

/** Only a server response with waiting candidates and no uncertain/rejected work authorizes automatic progress. */
const canAutomaticallyProgressResponseGroup = (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
): boolean => {
  const raw = storage.getItem(progressKey(ownerId, groupId));
  if (raw === null || raw === "") {
    return false;
  }
  try {
    const parsed = eveResponseGroupResult.safeParse(JSON.parse(raw));
    return (
      parsed.success &&
      parsed.data.id === groupId &&
      parsed.data.candidates.some(
        (candidate) => candidate.state === "waiting"
      ) &&
      parsed.data.candidates.every(
        (candidate) =>
          candidate.state === "waiting" || candidate.state === "bound"
      )
    );
  } catch {
    return false;
  }
};

/** Clear permission before a request: a crash or lost response must never auto-redispatch. */
const stopAutomaticResponseGroupProgress = (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
): void => {
  storage.removeItem(progressKey(ownerId, groupId));
};

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
    storage.setItem(progressKey(ownerId, result.id), JSON.stringify(result));
  } else {
    storage.removeItem(recoveryKey(ownerId, result.id));
    stopAutomaticResponseGroupProgress(storage, ownerId, result.id);
  }
  if (
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
};

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
    throw new CreationRejectedError(primary.error, primary.code);
  }
  return result;
};
/** Advance only certified waiting candidates, retaining the exact saved request. */
const advanceWaitingResponseGroup = async (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
): Promise<z.output<typeof eveResponseGroupResult> | undefined> => {
  if (!canAutomaticallyProgressResponseGroup(storage, ownerId, groupId)) {
    return undefined;
  }
  const operation = readResponseGroupDraft(storage, ownerId, groupId);
  stopAutomaticResponseGroupProgress(storage, ownerId, groupId);
  if (!operation) {
    return undefined;
  }
  const result = await requestResponseGroup(operation);
  retainResponseGroupDraft(storage, ownerId, operation, result);
  return result;
};

export {
  advanceWaitingResponseGroup,
  canAutomaticallyProgressResponseGroup,
  stopAutomaticResponseGroupProgress,
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
};
