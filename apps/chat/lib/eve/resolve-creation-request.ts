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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveCreationRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveCreationRequest's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-params, max-statements, no-undefined -- * max-lines-per-function (#510): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): resolveCreationRequest uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining, typescript/strict-boolean-expressions -- Public operation/fork getters must be read once for the truthiness guard and again by the original destructuring; preserve nullish short-circuiting, access order, changed values and throws.
    if (operation.fork?.checkpointId) {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from readCreationRequest(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing binding own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...binding, group: undefined };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-undefined */
