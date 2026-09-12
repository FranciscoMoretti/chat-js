import { z } from "zod";
import { requestConversation } from "./create-conversation";
import {
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
import {
  type CreationScope,
  finishCreation,
  readCreationRequest,
} from "./pending-create";

/** Resolve one saved operation; ambiguous outcomes never release its draft. */
export async function resolveCreationRequest(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ownerId: string,
  operation: NonNullable<ReturnType<typeof readCreationRequest>>,
  scope?: CreationScope
) {
  if ("modelIds" in operation) {
    if (operation.fork?.checkpointId) {
      const { conversationId, checkpointId, beforeTurnId } = operation.fork;
      const response = await fetch(
        `/api/agent-conversations/${conversationId}/checkpoint`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checkpointId, beforeTurnId }),
          signal: AbortSignal.timeout(35_000),
        }
      );
      if (!response.ok) {
        throw new Error(
          "The comparison's saved conversation state is unconfirmed. Retry the saved request."
        );
      }
      z.object({
        ready: z.literal(true),
        conversationId: z.literal(conversationId),
        checkpointId: z.literal(checkpointId),
        beforeTurnId: z.literal(beforeTurnId),
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
    return bound.conversationId;
  }
  const binding = await requestConversation(operation);
  if (
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
  return binding.id;
}
