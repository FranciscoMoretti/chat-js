import type { z } from "zod";
import { CreationRejected } from "./create-conversation";
import {
  type CreationScope,
  finishCreation,
  readCreationRequest,
} from "./pending-create";
import { eveResponseGroupResult } from "./response-group-contracts";
import { eveResponseGroupInput } from "./response-group-input";

const recoveryKey = (ownerId: string, groupId: string) =>
  `chatjs.eve.comparison:${ownerId}:${groupId}`;
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readResponseGroupDraft(
  storage: StorageAccess,
  ownerId: string,
  groupId: string
) {
  const saved = storage.getItem(recoveryKey(ownerId, groupId));
  return saved ? eveResponseGroupInput.parse(JSON.parse(saved)) : undefined;
}

/** Move recovery to its bound group before allowing a new request in this composer. */
export function retainResponseGroupDraft(
  storage: StorageAccess,
  ownerId: string,
  operation: z.infer<typeof eveResponseGroupInput>,
  result: z.infer<typeof eveResponseGroupResult>,
  scope?: CreationScope
) {
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
}

export async function requestResponseGroup(
  operation: z.infer<typeof eveResponseGroupInput>
) {
  const response = await fetch("/api/agent-response-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(operation),
    signal: AbortSignal.timeout(75_000),
  });
  if (!response.ok) {
    throw new Error(
      "Comparison creation is unconfirmed. Retry the saved request."
    );
  }
  const result = eveResponseGroupResult.parse(await response.json());
  const primary = result.candidates[0];
  if (
    primary?.state === "rejected" &&
    (result.candidates
      .slice(1)
      .every((candidate) => candidate.state === "waiting") ||
      result.candidates.every((candidate) => candidate.state === "rejected"))
  ) {
    throw new CreationRejected(
      primary.error,
      primary.code === "project_not_found"
    );
  }
  return result;
}
