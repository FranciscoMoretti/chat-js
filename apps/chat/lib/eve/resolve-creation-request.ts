import { isNonEmptyString } from "@/lib/is-non-empty-string";

import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
import {
  CreationRejectedError,
  requestConversation,
} from "./create-conversation";
import { finishCreation, readCreationRequest } from "./pending-create";
import {
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
import type { CreationScope } from "./pending-create";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { z } from "zod";

const CHECKPOINT_READ_TIMEOUT_MS = 35_000;
const HTTP_CONFLICT = 409;

/**
 * Resolve one saved operation; ambiguous outcomes never release its draft.
 *
 * @param {Pick<Storage, "getItem" | "setItem" | "removeItem">} storage Storage containing the pending creation request and retained comparison draft.
 * @param {string} ownerId Owner used to locate and finish the saved request.
 * @param {NonNullable<ReturnType<typeof readCreationRequest>>} operation Saved conversation or comparison operation whose identities are reused on retry.
 * @param {CreationScope} scope Optional creation scope used to locate the pending request and retain its draft.
 * @returns {Promise<Awaited<ReturnType<typeof requestConversation>> & { group: undefined } | { group: Awaited<ReturnType<typeof requestResponseGroup>>; id: string; sessionId: string }>} The confirmed conversation binding and comparison result when applicable; unconfirmed creation or checkpoint state rejects.
 */
export const resolveCreationRequest = async (
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ownerId: string,
  operation: ReadonlyNativeSurface<
    NonNullable<ReturnType<typeof readCreationRequest>>
  >,
  scope?: ReadonlyNativeSurface<CreationScope>
): Promise<
  | {
      group: Awaited<ReturnType<typeof requestResponseGroup>>;
      id: string;
      sessionId: string;
    }
  | (Awaited<ReturnType<typeof requestConversation>> & { group: undefined })
> => {
  if ("modelIds" in operation) {
    if (isNonEmptyString(operation.fork?.checkpointId)) {
      const { conversationId, checkpointId, beforeTurnId } = operation.fork;
      const response = await fetch(
        `/api/agent-conversations/${conversationId}/checkpoint`,
        {
          body: JSON.stringify({ beforeTurnId, checkpointId }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(CHECKPOINT_READ_TIMEOUT_MS),
        }
      );
      if (!response.ok) {
        const rejection = z
          .object({
            beforeTurnId: z.literal(beforeTurnId),
            checkpointId: z.literal(checkpointId),
            checkpointRejected: z.literal(true),
            conversationId: z.literal(conversationId),
            reason: checkpointRejectionReason,
          })
          .safeParse(
            await response.json().catch((): void => {
              // The checkpoint-rejection schema rejects an absent JSON body.
            })
          );
        if (response.status === HTTP_CONFLICT && rejection.success) {
          throw new CreationRejectedError(
            new CheckpointRejectedError(rejection.data.reason).message
          );
        }
        throw new Error(
          "The comparison's saved conversation state is unconfirmed. Retry the saved request."
        );
      }
      z.object({
        beforeTurnId: z.literal(beforeTurnId),
        checkpointId: z.literal(checkpointId),
        conversationId: z.literal(conversationId),
        ready: z.literal(true),
      }).parse(await response.json());
    }
    const result = await requestResponseGroup(operation);
    const bound = result.candidates.find(
      (candidate) => candidate.state === "bound"
    );
    if (!bound) {
      throw new Error(
        "Comparison creation is unconfirmed. Retry this saved request."
      );
    }
    retainResponseGroupDraft(storage, ownerId, operation, result, scope);
    return {
      group: result,
      id: bound.conversationId,
      sessionId: bound.sessionId,
    };
  }
  const binding = await requestConversation(operation);
  if (
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
  return { ...binding, group: undefined };
};
