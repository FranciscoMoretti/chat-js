import { requestConversation } from "./create-conversation";
import { finishCreation, readCreationRequest } from "./pending-create";
import {
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
import type { CreationScope } from "./pending-create";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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
